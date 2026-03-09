import { computePlayerUnitCount, computeGlobalCap } from './cap.js';
import { computeSendCount } from './dispatch_math.js';
import { isDispatchAllowed } from './barrier.js';
import { canActivateDoctrine, normalizeDoctrineId } from './doctrine.js';
import { isTerritoryBonusBlockedAtPoint } from './mutator.js';
import { getTerritoryOwnersAtPoint } from './territory.js';
import { AI_ARCHETYPES, SIM_CONSTANTS, difficultyConfig, isNodeAssimilated, nodeLevelDefMult, nodeTypeOf, upgradeCost } from './shared_config.js';

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function dist(a, b) {
    var dx = (b.x || 0) - (a.x || 0);
    var dy = (b.y || 0) - (a.y || 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function pointToSegmentDistSq(point, a, b) {
    var px = Number(point && point.x) || 0;
    var py = Number(point && point.y) || 0;
    var ax = Number(a && a.x) || 0;
    var ay = Number(a && a.y) || 0;
    var bx = Number(b && b.x) || 0;
    var by = Number(b && b.y) || 0;
    var abx = bx - ax;
    var aby = by - ay;
    var apx = px - ax;
    var apy = py - ay;
    var abLenSq = abx * abx + aby * aby;
    if (abLenSq <= 0.0001) {
        var dx = px - ax;
        var dy = py - ay;
        return dx * dx + dy * dy;
    }
    var t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    var closestX = ax + abx * t;
    var closestY = ay + aby * t;
    var cdx = px - closestX;
    var cdy = py - closestY;
    return cdx * cdx + cdy * cdy;
}

function strategicPulseAppliesToNode(state, nodeId) {
    return !!(state.strategicPulse && state.strategicPulse.active && state.strategicPulse.nodeId === nodeId);
}

function strongestHumanPower(state, selfIndex, powerByPlayer) {
    var best = 1;
    for (var i = 0; i < state.players.length; i++) {
        var player = state.players[i];
        if (!player || player.isAI || i === selfIndex) continue;
        best = Math.max(best, Number(powerByPlayer[i]) || 0);
    }
    return best;
}

function resolveHoldingFleetPoint(fleet) {
    if (!fleet) return null;
    if (Number.isFinite(fleet.x) && Number.isFinite(fleet.y)) {
        return { x: Number(fleet.x), y: Number(fleet.y) };
    }
    if (Number.isFinite(fleet.toX) && Number.isFinite(fleet.toY)) {
        return { x: Number(fleet.toX), y: Number(fleet.toY) };
    }
    if (Number.isFinite(fleet.fromX) && Number.isFinite(fleet.fromY)) {
        return { x: Number(fleet.fromX), y: Number(fleet.fromY) };
    }
    return null;
}

function computeFleetSendCount(fleetCount, pct) {
    var available = Math.max(0, Math.floor(Number(fleetCount) || 0));
    if (available <= 0) return 0;
    if (pct >= 0.999) return available;
    return Math.min(available, Math.max(1, Math.floor(available * pct)));
}

export function decideAiCommands(state, playerIndex) {
    state = state || {};
    var commands = [];
    var own = [];
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i] && state.nodes[i].owner === playerIndex) own.push(state.nodes[i]);
    if (!own.length) return commands;

    var profile = state.aiProfiles && state.aiProfiles[playerIndex] ? state.aiProfiles[playerIndex] : AI_ARCHETYPES[1];
    var diffCfg = state.diffCfg || difficultyConfig(state.diff);
    var useFog = !!diffCfg.aiUsesFog;
    var power = state.powerByPlayer || {};
    var myPower = Number(power[playerIndex]) || 1;
    var humanPower = strongestHumanPower(state, playerIndex, power);
    var delta = humanPower - myPower;
    var assist = state.tune && state.tune.aiAssist ? clamp(delta / 420, -0.12, SIM_CONSTANTS.DDA_MAX_BOOST) : 0;
    var aggr = (Number(state.tune && state.tune.aiAgg) || 1) * (Number(profile.aggr) || 1) * (1 + assist * 0.8);
    var reserve = Math.max(2, Math.floor((Number(state.tune && state.tune.aiBuf) || 0) * (Number(profile.reserve) || 1) * (1 - assist * 0.5)));
    var extraSources = Math.max(0, Math.floor(Number(diffCfg.aiExtraSources) || 0));
    var maxSources = (profile.name === 'Rusher' ? 4 : 3) + extraSources;
    var barrierCfg = state.mapFeature && state.mapFeature.type === 'barrier' ? state.mapFeature : null;
    var ownsGate = false;
    var humanOwners = {};
    var humanCapitalIds = {};
    var humanCapitalNodes = [];
    var aiReserveScale = Number(diffCfg.aiReserveScale);
    var aiCommitMax = Number(diffCfg.aiCommitMax);
    var aiCriticalCommitMax = Number(diffCfg.aiCriticalCommitMax);
    var aiOpportunityRatio = Number(diffCfg.aiOpportunityRatio);
    var aiTargetHumanBias = Number(diffCfg.aiTargetHumanBias);
    var aiTargetCapitalBias = Number(diffCfg.aiTargetCapitalBias);
    var aiFlowPeriod = Math.max(1, Math.floor(Number(diffCfg.aiFlowPeriod) || 13));
    var aiUpgradePeriod = Math.max(1, Math.floor(Number(diffCfg.aiUpgradePeriod) || 19));
    var doctrineId = state.doctrines && state.doctrines[playerIndex] ? normalizeDoctrineId(state.doctrines[playerIndex]) : '';

    if (!Number.isFinite(aiReserveScale) || aiReserveScale <= 0) aiReserveScale = 1;
    if (!Number.isFinite(aiCommitMax) || aiCommitMax <= 0) aiCommitMax = 0.75;
    if (!Number.isFinite(aiCriticalCommitMax) || aiCriticalCommitMax < aiCommitMax) aiCriticalCommitMax = Math.min(1, aiCommitMax + 0.08);
    if (!Number.isFinite(aiOpportunityRatio) || aiOpportunityRatio <= 0) aiOpportunityRatio = 0.55;
    if (!Number.isFinite(aiTargetHumanBias)) aiTargetHumanBias = 0;
    if (!Number.isFinite(aiTargetCapitalBias)) aiTargetCapitalBias = 0;

    if (barrierCfg && Array.isArray(barrierCfg.gateIds)) {
        for (var gi = 0; gi < barrierCfg.gateIds.length; gi++) {
            var gateNode = state.nodes[barrierCfg.gateIds[gi]];
            if (!gateNode || !gateNode.gate || gateNode.owner !== playerIndex || !isNodeAssimilated(gateNode)) continue;
            ownsGate = true;
            break;
        }
    }

    for (var hi = 0; hi < state.players.length; hi++) {
        var maybeHuman = state.players[hi];
        if (!maybeHuman || maybeHuman.isAI) continue;
        humanOwners[hi] = true;
        var capitalId = state.playerCapital && state.playerCapital[hi] !== undefined ? Number(state.playerCapital[hi]) : -1;
        if (capitalId >= 0 && state.nodes[capitalId]) {
            humanCapitalIds[capitalId] = true;
            humanCapitalNodes.push(state.nodes[capitalId]);
        }
    }

    var myUnits = (state.unitByPlayer && Number(state.unitByPlayer[playerIndex])) || computePlayerUnitCount({ nodes: state.nodes, fleets: state.fleets, owner: playerIndex });
    var myCap = (state.capByPlayer && Number(state.capByPlayer[playerIndex])) || computeGlobalCap({
        nodes: state.nodes,
        owner: playerIndex,
        baseCap: state.rules ? state.rules.baseCap : 180,
        capPerNodeFactor: state.rules ? state.rules.capPerNodeFactor : 42,
    });
    var capPressure = myCap > 0 ? myUnits / myCap : 0;
    if (capPressure > 0.85) reserve = Math.max(1, Math.floor(reserve * 0.72));
    reserve = Math.max(1, Math.floor(reserve * aiReserveScale));
    var maxSupportAssets = maxSources + 1;
    var turretSiegeMinBurst = 72;
    var plannedNodeCommit = {};
    var plannedFleetCommit = {};
    var territoryCache = {};
    var turretThreatCache = {};
    var hostileTurrets = [];

    function canDispatchAI(srcNode, tgtNode) {
        return isDispatchAllowed({ src: srcNode, tgt: tgtNode, barrier: barrierCfg, owner: playerIndex, nodes: state.nodes });
    }

    function territoryStateForPoint(point) {
        if (!point) {
            return {
                friendly: false,
                friendlySafe: false,
                contested: false,
                hostile: false,
                neutral: true,
                ownerCount: 0,
                owners: {},
            };
        }
        var x = Number(point.x) || 0;
        var y = Number(point.y) || 0;
        var key = Math.round(x * 4) + ':' + Math.round(y * 4);
        if (!territoryCache[key]) {
            var presence = getTerritoryOwnersAtPoint({
                point: { x: x, y: y },
                nodes: state.nodes,
                callbacks: {
                    isNodeTerritoryActive: isNodeAssimilated,
                    isTerritoryBonusBlockedAtPoint: function (opts) {
                        return isTerritoryBonusBlockedAtPoint({
                            point: opts && opts.point,
                            mapMutator: state.mapMutator,
                        });
                    },
                },
            });
            territoryCache[key] = {
                owners: presence.owners,
                ownerCount: presence.ownerCount,
                bonusBlocked: presence.bonusBlocked === true,
                friendly: !!presence.owners[playerIndex],
                friendlySafe: presence.ownerCount === 1 && presence.owners[playerIndex] === true && presence.bonusBlocked !== true,
                contested: presence.ownerCount > 1,
                hostile: presence.ownerCount > 0 && !presence.owners[playerIndex],
                neutral: presence.ownerCount === 0,
            };
        }
        return territoryCache[key];
    }

    var ownTerritoryState = {};
    function sourceReserveForNode(node) {
        if (!node) return reserve;
        if (ownTerritoryState[node.id] === undefined) ownTerritoryState[node.id] = territoryStateForPoint(node.pos);
        var territoryState = ownTerritoryState[node.id];
        var nodeReserve = reserve;
        if (!isNodeAssimilated(node)) nodeReserve += 7;
        else if (territoryState.contested) nodeReserve += 4;
        else if (!territoryState.friendlySafe) nodeReserve += 2;
        if (node.gate) nodeReserve += 4;
        if (node.defense) nodeReserve += 2;
        if (node.kind === 'turret') nodeReserve += 3;
        return nodeReserve;
    }

    function availableNodeUnits(node) {
        return Math.max(0, (Number(node && node.units) || 0) - sourceReserveForNode(node) - (plannedNodeCommit[node.id] || 0));
    }

    function availableFleetUnits(fleet) {
        return Math.max(0, (Number(fleet && fleet.count) || 0) - (plannedFleetCommit[fleet.id] || 0));
    }

    function estimateSendCountFromNode(node, pct) {
        var available = availableNodeUnits(node);
        if (available <= 1) return 0;
        return computeSendCount({
            srcUnits: available,
            pct: pct,
            flowMult: nodeTypeOf(node).flow,
        }).sendCount;
    }

    function estimateSendCountFromFleet(fleet, pct) {
        var available = availableFleetUnits(fleet);
        if (available <= 0) return 0;
        return computeFleetSendCount(available, pct);
    }

    function markCommittedAssets(sourceIds, fleetIds, pct) {
        for (var si = 0; si < sourceIds.length; si++) {
            var sourceNode = state.nodes[sourceIds[si]];
            if (!sourceNode) continue;
            plannedNodeCommit[sourceNode.id] = (plannedNodeCommit[sourceNode.id] || 0) + estimateSendCountFromNode(sourceNode, pct);
        }
        for (var fi = 0; fi < fleetIds.length; fi++) {
            var fleet = null;
            for (var sf = 0; sf < state.fleets.length; sf++) {
                if (state.fleets[sf] && (Number(state.fleets[sf].id) || 0) === fleetIds[fi]) {
                    fleet = state.fleets[sf];
                    break;
                }
            }
            if (!fleet) continue;
            plannedFleetCommit[fleet.id] = (plannedFleetCommit[fleet.id] || 0) + estimateSendCountFromFleet(fleet, pct);
        }
    }

    function computeLocalPressure(point) {
        var result = { friendly: 0, enemy: 0 };
        if (!point) return result;
        var pressureRadius = SIM_CONSTANTS.SUPPLY_DIST * 1.15;
        for (var ni = 0; ni < state.nodes.length; ni++) {
            var node = state.nodes[ni];
            if (!node || !node.pos || node.owner < 0) continue;
            var distance = dist(node.pos, point);
            if (distance > pressureRadius) continue;
            var weight = Math.max(0.18, 1 - distance / (pressureRadius * 1.08));
            var nodePressure = Math.max(0, Number(node.units) || 0) * weight;
            if (node.defense) nodePressure *= 1.08;
            if (node.kind === 'turret') nodePressure *= 1.22;
            if ((Number(node.level) || 1) > 1) nodePressure *= 1 + ((Number(node.level) || 1) - 1) * 0.06;
            if (node.owner === playerIndex) result.friendly += Math.max(0, availableNodeUnits(node)) * weight;
            else result.enemy += nodePressure;
        }
        return result;
    }

    function isHostileTurretThreat(node) {
        if (!node || node.kind !== 'turret' || !node.pos || node.owner === playerIndex) return false;
        var garrison = Math.max(0, Number(node.units) || 0);
        if (node.owner === -1) return garrison >= SIM_CONSTANTS.TURRET_MIN_GARRISON && isNodeAssimilated(node);
        return garrison >= 1;
    }

    for (var ht = 0; ht < state.nodes.length; ht++) {
        if (isHostileTurretThreat(state.nodes[ht])) hostileTurrets.push(state.nodes[ht]);
    }

    function turretThreatForPoint(point) {
        if (!point) {
            return {
                covered: false,
                count: 0,
                primaryId: null,
                primaryPos: null,
                minSafeDistance: SIM_CONSTANTS.TURRET_RANGE + 24,
            };
        }
        var x = Number(point.x) || 0;
        var y = Number(point.y) || 0;
        var key = Math.round(x * 4) + ':' + Math.round(y * 4);
        if (!turretThreatCache[key]) {
            var threat = {
                covered: false,
                count: 0,
                primaryId: null,
                primaryPos: null,
                minSafeDistance: SIM_CONSTANTS.TURRET_RANGE + 24,
            };
            var bestDist = Infinity;
            for (var ti = 0; ti < state.nodes.length; ti++) {
                var node = state.nodes[ti];
                if (!isHostileTurretThreat(node)) continue;
                var distance = dist(node.pos, { x: x, y: y });
                if (distance > SIM_CONSTANTS.TURRET_RANGE) continue;
                threat.covered = true;
                threat.count++;
                if (distance < bestDist) {
                    bestDist = distance;
                    threat.primaryId = node.id;
                    threat.primaryPos = { x: Number(node.pos.x) || 0, y: Number(node.pos.y) || 0 };
                }
            }
            turretThreatCache[key] = threat;
        }
        return turretThreatCache[key];
    }

    function turretThreatForRoute(startPoint, endPoint) {
        if (!startPoint || !endPoint) {
            return {
                crossed: false,
                count: 0,
                primaryId: null,
                primaryPos: null,
            };
        }
        var bestDistSq = Infinity;
        var threat = {
            crossed: false,
            count: 0,
            primaryId: null,
            primaryPos: null,
        };
        for (var i = 0; i < hostileTurrets.length; i++) {
            var turret = hostileTurrets[i];
            var rangeSq = SIM_CONSTANTS.TURRET_RANGE * SIM_CONSTANTS.TURRET_RANGE;
            var routeDistSq = pointToSegmentDistSq(turret.pos, startPoint, endPoint);
            if (routeDistSq > rangeSq) continue;
            threat.crossed = true;
            threat.count++;
            if (routeDistSq < bestDistSq) {
                bestDistSq = routeDistSq;
                threat.primaryId = turret.id;
                threat.primaryPos = { x: Number(turret.pos.x) || 0, y: Number(turret.pos.y) || 0 };
            }
        }
        return threat;
    }

    function chooseStagePoint(anchorNode, targetPoint, minDistanceFromTarget) {
        if (!anchorNode || !anchorNode.pos || !targetPoint) return null;
        var anchorX = Number(anchorNode.pos.x) || 0;
        var anchorY = Number(anchorNode.pos.y) || 0;
        var targetX = Number(targetPoint.x) || 0;
        var targetY = Number(targetPoint.y) || 0;
        var dx = targetX - anchorX;
        var dy = targetY - anchorY;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var dirX = dx / len;
        var dirY = dy / len;
        var minDist = Number(minDistanceFromTarget);
        if (Number.isFinite(minDist) && minDist > 0) {
            var awayX = anchorX - targetX;
            var awayY = anchorY - targetY;
            var awayLen = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
            var awayDirX = awayX / awayLen;
            var awayDirY = awayY / awayLen;
            var distanceOptions = [
                minDist + 36,
                minDist + 18,
                Math.max(minDist + 8, awayLen),
                awayLen + 18,
                awayLen + 42,
            ];
            for (var di = 0; di < distanceOptions.length; di++) {
                var outerPoint = {
                    x: targetX + awayDirX * distanceOptions[di],
                    y: targetY + awayDirY * distanceOptions[di],
                };
                if (turretThreatForPoint(outerPoint).covered) continue;
                if (territoryStateForPoint(outerPoint).friendlySafe) return outerPoint;
            }
        }
        var offsets = [42, 28, 16, 0, -12, -24, -38];
        for (var oi = 0; oi < offsets.length; oi++) {
            var point = {
                x: anchorX + dirX * offsets[oi],
                y: anchorY + dirY * offsets[oi],
            };
            if (Number.isFinite(minDist) && minDist > 0) {
                if (dist(point, { x: targetX, y: targetY }) < minDist) continue;
                if (turretThreatForPoint(point).covered) continue;
            }
            if (territoryStateForPoint(point).friendlySafe) return point;
        }
        return null;
    }

    var holdingAssets = [];
    for (var hf = 0; hf < state.fleets.length; hf++) {
        var fleet = state.fleets[hf];
        if (!fleet || !fleet.active || !fleet.holding || fleet.owner !== playerIndex) continue;
        var fleetPoint = resolveHoldingFleetPoint(fleet);
        if (!fleetPoint) continue;
        holdingAssets.push({
            fleet: fleet,
            point: fleetPoint,
            territory: territoryStateForPoint(fleetPoint),
        });
    }
    var incomingByTarget = {};
    for (var af = 0; af < state.fleets.length; af++) {
        var activeFleet = state.fleets[af];
        if (!activeFleet || !activeFleet.active || activeFleet.holding || activeFleet.owner !== playerIndex) continue;
        var activeTargetId = Math.floor(Number(activeFleet.tgtId));
        if (!Number.isFinite(activeTargetId) || activeTargetId < 0) continue;
        incomingByTarget[activeTargetId] = (incomingByTarget[activeTargetId] || 0) + Math.max(0, Math.floor(Number(activeFleet.count) || 0));
    }

    var stagingUsed = false;

    function estimateBurstUnits(sourceIds, fleetIds, pct) {
        var burst = 0;
        for (var i = 0; i < sourceIds.length; i++) {
            var sourceNode = state.nodes[sourceIds[i]];
            if (!sourceNode) continue;
            burst += estimateSendCountFromNode(sourceNode, pct);
        }
        for (var j = 0; j < fleetIds.length; j++) {
            for (var fk = 0; fk < holdingAssets.length; fk++) {
                var holdingFleet = holdingAssets[fk] && holdingAssets[fk].fleet;
                if (!holdingFleet || (Number(holdingFleet.id) || 0) !== fleetIds[j]) continue;
                burst += estimateSendCountFromFleet(holdingFleet, pct);
                break;
            }
        }
        return burst;
    }

    function chooseSiegeAnchor(targetNode, target) {
        if (!targetNode) return null;
        var preferred = [];
        var fallback = [];
        for (var i = 0; i < own.length; i++) {
            var node = own[i];
            if (!node || !isNodeAssimilated(node)) continue;
            if (!canDispatchAI(node, targetNode)) continue;
            if (turretThreatForPoint(node.pos).covered) continue;
            if (territoryStateForPoint(node.pos).friendlySafe) preferred.push(node);
            else fallback.push(node);
        }
        function byDistance(a, b) {
            return dist(a.pos, targetNode.pos) - dist(b.pos, targetNode.pos);
        }
        preferred.sort(byDistance);
        fallback.sort(byDistance);
        return preferred[0] || fallback[0] || null;
    }

    function bestRouteTurretThreat(targetNode) {
        var anchor = chooseSiegeAnchor(targetNode);
        if (!anchor) {
            return {
                crossed: false,
                count: 0,
                primaryId: null,
                primaryPos: null,
                anchorId: null,
            };
        }
        var threat = turretThreatForRoute(anchor.pos, targetNode.pos);
        threat.anchorId = anchor.id;
        return threat;
    }

    function attemptSiegeNodeStage(target, targetNode, anchorNode, launchThreshold) {
        if (!targetNode || !anchorNode) return false;
        var anchorAvailable = availableNodeUnits(anchorNode);
        var anchorIncoming = Math.max(0, Number(incomingByTarget[anchorNode.id]) || 0);
        var stageNeed = Math.max(0, launchThreshold - anchorAvailable - anchorIncoming);
        if (stageNeed <= 4) return false;

        var stageSources = [];
        var stageTotal = 0;
        var stageCandidates = own.filter(function (node) {
            if (!node || node.id === anchorNode.id) return false;
            if (availableNodeUnits(node) <= 6) return false;
            return canDispatchAI(node, anchorNode);
        }).sort(function (a, b) {
            var aRouteUnsafe = turretThreatForRoute(a.pos, anchorNode.pos).crossed ? 1 : 0;
            var bRouteUnsafe = turretThreatForRoute(b.pos, anchorNode.pos).crossed ? 1 : 0;
            if (aRouteUnsafe !== bRouteUnsafe) return aRouteUnsafe - bRouteUnsafe;
            var aCovered = turretThreatForPoint(a.pos).covered ? 1 : 0;
            var bCovered = turretThreatForPoint(b.pos).covered ? 1 : 0;
            if (aCovered !== bCovered) return aCovered - bCovered;
            var aAvail = availableNodeUnits(a);
            var bAvail = availableNodeUnits(b);
            if (aAvail !== bAvail) return bAvail - aAvail;
            return dist(a.pos, anchorNode.pos) - dist(b.pos, anchorNode.pos);
        });

        for (var si = 0; si < stageCandidates.length && stageSources.length < maxSources; si++) {
            var sourceNode = stageCandidates[si];
            var available = availableNodeUnits(sourceNode);
            if (available <= 0) continue;
            stageSources.push(sourceNode.id);
            stageTotal += available;
            if (stageTotal >= stageNeed) break;
        }
        if (!stageSources.length) return false;

        var stagePct = clamp(stageNeed / Math.max(stageTotal, 1), 0.35, 0.78);
        commands.push({ type: 'send', data: { sources: stageSources, tgtId: anchorNode.id, pct: stagePct } });
        markCommittedAssets(stageSources, [], stagePct);
        return true;
    }

    function attemptStagePush(target, targetNode, needed) {
        if (stagingUsed || !targetNode || targetNode.owner === -1) return false;
        if (!(target.humanOwned || target.humanCapital || targetNode.kind === 'turret' || targetNode.gate || target.territory.hostile)) return false;

        var anchorCandidates = own.filter(function (node) {
            return isNodeAssimilated(node) && canDispatchAI(node, targetNode);
        }).sort(function (a, b) {
            return dist(a.pos, targetNode.pos) - dist(b.pos, targetNode.pos);
        });
        var anchor = anchorCandidates[0] || null;
        var dangerPoint = targetNode.pos;
        var minDangerDistance = 0;
        if (targetNode.kind === 'turret') {
            minDangerDistance = SIM_CONSTANTS.TURRET_RANGE + 24;
        } else if (target.turretThreat && target.turretThreat.covered) {
            dangerPoint = target.turretThreat.primaryPos || targetNode.pos;
            minDangerDistance = Number(target.turretThreat.minSafeDistance) || (SIM_CONSTANTS.TURRET_RANGE + 24);
        }
        var stagePoint = chooseStagePoint(
            anchor,
            dangerPoint,
            minDangerDistance
        );
        if (!stagePoint) return false;

        var stageNeed = Math.max(12, Math.min(needed * 0.45, Math.max(16, needed)));
        var stageSources = [];
        var stageTotal = 0;
        var existingStaging = 0;
        for (var eh = 0; eh < holdingAssets.length; eh++) {
            var staged = holdingAssets[eh];
            if (dist(staged.point, stagePoint) > 56) continue;
            existingStaging += availableFleetUnits(staged.fleet);
        }
        if (existingStaging >= stageNeed * 0.7) return false;

        var stageCandidates = own.filter(function (node) {
            if (!node || node.id === (anchor && anchor.id)) return false;
            if (!territoryStateForPoint(node.pos).friendlySafe) return false;
            if (!canDispatchAI(node, { pos: stagePoint })) return false;
            return availableNodeUnits(node) > 6;
        }).sort(function (a, b) {
            var aAvail = availableNodeUnits(a);
            var bAvail = availableNodeUnits(b);
            if (aAvail !== bAvail) return bAvail - aAvail;
            return dist(b.pos, targetNode.pos) - dist(a.pos, targetNode.pos);
        });

        for (var sc = 0; sc < stageCandidates.length && stageSources.length < maxSources; sc++) {
            var stagedAvailable = availableNodeUnits(stageCandidates[sc]);
            if (stagedAvailable <= 0) continue;
            stageSources.push(stageCandidates[sc].id);
            stageTotal += stagedAvailable;
            if (stageTotal >= stageNeed) break;
        }
        if (!stageSources.length || stageTotal < 10) return false;

        var stagePct = clamp(stageNeed / Math.max(stageTotal, 1), 0.28, target.humanCapital || targetNode.kind === 'turret' ? 0.58 : 0.52);
        commands.push({ type: 'send', data: { sources: stageSources, targetPoint: stagePoint, pct: stagePct } });
        markCommittedAssets(stageSources, [], stagePct);
        stagingUsed = true;
        return true;
    }

    var targets = [];
    for (var ni = 0; ni < state.nodes.length; ni++) {
        var node = state.nodes[ni];
        if (!node || node.owner === playerIndex) continue;
        if (useFog && !(state.fog && state.fog.vis && state.fog.vis[playerIndex] && state.fog.vis[playerIndex][node.id])) continue;
        var targetUnits = useFog
            ? (state.fog.vis[playerIndex][node.id] ? node.units : ((((state.fog.ls || [])[playerIndex] || [])[node.id] || {}).units || 0))
            : node.units;
        var targetDefense = nodeTypeOf(node).def * nodeLevelDefMult(node) * (node.owner >= 0 ? (Number(state.tune && state.tune.def) || 1) : 1);

        var bestDistance = Infinity;
        var reachable = false;
        var localSupport = 0;
        for (var oi = 0; oi < own.length; oi++) {
            if (!canDispatchAI(own[oi], node)) continue;
            var distance = dist(own[oi].pos, node.pos);
            localSupport += Math.max(0, (Number(own[oi].units) || 0) - sourceReserveForNode(own[oi]));
            reachable = true;
            if (distance < bestDistance) bestDistance = distance;
        }
        if (!reachable) continue;

        var humanOwnedTarget = !!humanOwners[node.owner];
        var humanCapitalTarget = !!humanCapitalIds[node.id];
        var humanCapitalDistance = Infinity;
        if (humanOwnedTarget && humanCapitalNodes.length) {
            for (var hc = 0; hc < humanCapitalNodes.length; hc++) {
                var capitalDistance = dist(node.pos, humanCapitalNodes[hc].pos);
                if (capitalDistance < humanCapitalDistance) humanCapitalDistance = capitalDistance;
            }
        }

        var territoryState = territoryStateForPoint(node.pos);
        var turretThreat = turretThreatForPoint(node.pos);
        var routeThreat = bestRouteTurretThreat(node);
        var localPressure = computeLocalPressure(node.pos);
        var localEnemyPressure = localPressure.enemy;
        var localFriendlyPressure = localPressure.friendly;
        var pressureGap = Math.max(0, localEnemyPressure - Math.max(localSupport, localFriendlyPressure));
        var incomingFriendly = incomingByTarget[node.id] || 0;
        var score = 0;
        score += Math.max(0, 520 - bestDistance) * 0.45;
        score += Math.max(0, 55 - targetUnits * targetDefense) * 2.1;
        score += (Number(node.radius) || 0) * 0.75;
        if (node.owner === -1) score += 34;
        if (node.owner === -1 && myPower > humanPower * 1.08) score -= 12;
        if (node.kind === 'forge') score += 20;
        if (node.kind === 'relay') score += 12;
        if (node.kind === 'turret') score -= 18;
        if (node.encounterType === 'relay_core') score += doctrineId === 'logistics' ? 72 : 46;
        if (node.encounterType === 'mega_turret') score += doctrineId === 'siege' ? 86 : 28;
        if (node.gate && node.owner !== playerIndex) score += ownsGate ? 10 : 64;
        if (strategicPulseAppliesToNode(state, node.id)) score += SIM_CONSTANTS.STRATEGIC_PULSE_AI_BONUS;
        if ((Number(node.level) || 1) > 1) score += ((Number(node.level) || 1) - 1) * 11;
        if (humanOwnedTarget) score += aiTargetHumanBias;
        if (humanCapitalTarget) score += aiTargetCapitalBias;
        if (humanOwnedTarget && humanCapitalDistance < Infinity) score += Math.max(0, 280 - humanCapitalDistance) * 0.08;
        if (capPressure > 0.9) score += Math.max(0, 44 - targetUnits * targetDefense) * 0.6;
        if (territoryState.friendlySafe) score += node.owner === -1 ? 10 : 54;
        else if (territoryState.contested) score += 22;
        else if (territoryState.hostile) score -= 16;
        else score += 6;
        if (territoryState.bonusBlocked && node.owner !== playerIndex) score += 12;
        else if (territoryState.bonusBlocked) score -= 8;
        if (!isNodeAssimilated(node) && node.owner !== -1) score += territoryState.hostile ? 9 : 18;
        if (doctrineId === 'assimilation' && !isNodeAssimilated(node) && node.owner !== playerIndex) score += 20;
        if (doctrineId === 'assimilation' && node.owner === -1) score += 10;
        if (doctrineId === 'logistics' && territoryState.friendlySafe) score += 12;
        if (doctrineId === 'siege' && (node.kind === 'turret' || node.defense)) score += 32;
        if (pressureGap > 0) score -= Math.min(48, pressureGap * 0.35);
        else score += Math.min(18, (Math.max(localSupport, localFriendlyPressure) - localEnemyPressure) * 0.12);
        if ((turretThreat.covered || routeThreat.crossed) && node.kind !== 'turret') score -= humanCapitalTarget ? 28 : 84;
        if (node.kind === 'turret') {
            var turretPressureNeed = targetUnits * targetDefense + 23 + (Number(node.level) || 1) * 3;
            var turretSupportRatio = localSupport / Math.max(1, turretPressureNeed);
            if (turretSupportRatio < 0.4) score -= 140;
            else if (turretSupportRatio < 0.65) score -= 90;
            else if (turretSupportRatio < 0.85) score -= 50;
            else if (turretSupportRatio < 1.0) score -= 22;
            if (incomingFriendly > 0) score -= Math.min(42, incomingFriendly * 0.55);
        }
        score *= aggr;
        targets.push({
            id: node.id,
            score: score,
            units: targetUnits,
            effDef: targetDefense,
            humanOwned: humanOwnedTarget,
            humanCapital: humanCapitalTarget,
            territory: territoryState,
            turretThreat: turretThreat,
            routeThreat: routeThreat,
            localEnemyPressure: localEnemyPressure,
            localFriendlyPressure: Math.max(localSupport, localFriendlyPressure),
            incomingFriendly: incomingFriendly,
        });
    }

    targets.sort(function (a, b) { return b.score - a.score; });
    var attackCount = myPower < humanPower ? 2 : 1;
    if (profile.name === 'Rusher') attackCount = Math.max(attackCount, 2);
    if (myPower >= humanPower * 0.9 && targets.length > 2) attackCount += 1;
    if (capPressure > 0.9) attackCount += 1;
    attackCount = Math.min(attackCount, targets.length, diffCfg.maxAttackTargets);

    for (var ti = 0; ti < attackCount; ti++) {
        var target = targets[ti];
        var targetNode = state.nodes[target.id];
        var sources = [];
        var fleetIds = [];
        var total = 0;
        var needed = target.units * target.effDef + 5 + (Number(targetNode.level) || 1) * 3;
        var incomingFriendly = Math.max(0, Number(target.incomingFriendly) || 0);
        var protectedByTurret = targetNode.kind === 'turret' ||
            !!(target.turretThreat && target.turretThreat.covered) ||
            !!(target.routeThreat && target.routeThreat.crossed);
        if (targetNode.kind === 'turret') needed += 18;
        if (targetNode.gate && targetNode.owner !== playerIndex && barrierCfg && !ownsGate) needed = Math.max(6, needed * 0.82);
        if (capPressure > 0.9) needed *= 0.93;
        if (target.territory.friendlySafe) needed *= 0.88;
        else if (target.territory.contested) needed *= 0.96;
        else if (target.territory.bonusBlocked && targetNode.owner !== playerIndex) needed *= 0.92;
        if (!isNodeAssimilated(targetNode) && targetNode.owner !== -1) needed *= target.territory.hostile ? 0.96 : 0.9;
        if (target.territory.hostile && targetNode.owner !== -1) {
            needed += Math.max(0, target.localEnemyPressure - target.localFriendlyPressure) * 0.16;
        }
        if (protectedByTurret && targetNode.kind !== 'turret') needed += 12;
        if (protectedByTurret) {
            var siegeCandidatesForBurst = [];
            var siegeFleetCandidatesForBurst = [];
            for (var sci = 0; sci < own.length; sci++) {
                var siegeCandidate = own[sci];
                if (!siegeCandidate || !isNodeAssimilated(siegeCandidate)) continue;
                if (!canDispatchAI(siegeCandidate, targetNode)) continue;
                if (turretThreatForPoint(siegeCandidate.pos).covered) continue;
                var siegeNodeAvail = availableNodeUnits(siegeCandidate);
                if (siegeNodeAvail <= 4) continue;
                siegeCandidatesForBurst.push({
                    node: siegeCandidate,
                    available: siegeNodeAvail,
                    distance: dist(siegeCandidate.pos, targetNode.pos),
                });
            }
            siegeCandidatesForBurst.sort(function (a, b) {
                if (Math.abs(a.available - b.available) > 10) return b.available - a.available;
                return a.distance - b.distance;
            });
            for (var sbf = 0; sbf < holdingAssets.length; sbf++) {
                var siegeHoldingAsset = holdingAssets[sbf];
                var siegeFleetAvail = availableFleetUnits(siegeHoldingAsset.fleet);
                if (siegeFleetAvail <= 0 || siegeHoldingAsset.territory.hostile) continue;
                if (!canDispatchAI({ pos: siegeHoldingAsset.point }, targetNode)) continue;
                if (turretThreatForPoint(siegeHoldingAsset.point).covered) continue;
                siegeFleetCandidatesForBurst.push({
                    fleet: siegeHoldingAsset.fleet,
                    available: siegeFleetAvail,
                });
            }
            siegeFleetCandidatesForBurst.sort(function (a, b) {
                return b.available - a.available;
            });

            var siegeBurstSources = [];
            var siegeBurstFleetIds = [];
            var siegeBurstTotal = 0;
            var burstLaunchThreshold = Math.max(turretSiegeMinBurst, needed * (targetNode.kind === 'turret' ? 0.85 : 0.8));
            for (var sck = 0; sck < siegeCandidatesForBurst.length && siegeBurstSources.length < maxSupportAssets; sck++) {
                siegeBurstSources.push(siegeCandidatesForBurst[sck].node.id);
                siegeBurstTotal += siegeCandidatesForBurst[sck].available;
            }
            for (var sfj = 0; sfj < siegeFleetCandidatesForBurst.length && (siegeBurstSources.length + siegeBurstFleetIds.length) < maxSupportAssets; sfj++) {
                siegeBurstFleetIds.push(siegeFleetCandidatesForBurst[sfj].fleet.id);
                siegeBurstTotal += siegeFleetCandidatesForBurst[sfj].available;
            }

            if (incomingFriendly >= burstLaunchThreshold * 0.6) continue;
            if (siegeBurstTotal >= burstLaunchThreshold && siegeBurstSources.length > 0) {
                var siegeBurstPct = (siegeBurstSources.length + siegeBurstFleetIds.length) <= 1 ? 1 : clamp(burstLaunchThreshold * 1.15 / Math.max(siegeBurstTotal, 1), 0.75, 0.95);
                commands.push({ type: 'send', data: { sources: siegeBurstSources, fleetIds: siegeBurstFleetIds, tgtId: targetNode.id, pct: siegeBurstPct } });
                markCommittedAssets(siegeBurstSources, siegeBurstFleetIds, siegeBurstPct);
                continue;
            }

            var siegeAnchor = siegeCandidatesForBurst[0] ? siegeCandidatesForBurst[0].node : chooseSiegeAnchor(targetNode, target);
            if (!siegeAnchor) continue;
            var stagingLaunchThreshold = Math.max(turretSiegeMinBurst, Math.min(targetNode.kind === 'turret' ? 80 : 72, needed * (targetNode.kind === 'turret' ? 1.02 : 0.96)));
            attemptSiegeNodeStage(target, targetNode, siegeAnchor, stagingLaunchThreshold);
            continue;
        }
        var assetCandidates = [];
        for (var cj = 0; cj < own.length; cj++) {
            var ownNode = own[cj];
            var availableNode = availableNodeUnits(ownNode);
            if (availableNode <= 1) continue;
            if (!isNodeAssimilated(ownNode) && !target.territory.friendlySafe) continue;
            if (!canDispatchAI(ownNode, targetNode)) continue;
            assetCandidates.push({
                type: 'node',
                id: ownNode.id,
                distance: dist(ownNode.pos, targetNode.pos),
                available: availableNode,
                value: ownNode,
            });
        }
        for (var hk = 0; hk < holdingAssets.length; hk++) {
            var holdingAsset = holdingAssets[hk];
            var availableFleet = availableFleetUnits(holdingAsset.fleet);
            if (availableFleet <= 0 || holdingAsset.territory.hostile) continue;
            if (!canDispatchAI({ pos: holdingAsset.point }, targetNode)) continue;
            assetCandidates.push({
                type: 'fleet',
                id: holdingAsset.fleet.id,
                distance: dist(holdingAsset.point, targetNode.pos),
                available: availableFleet,
                value: holdingAsset.fleet,
            });
        }
        assetCandidates.sort(function (a, b) {
            if (a.distance !== b.distance) return a.distance - b.distance;
            if (a.type !== b.type) return a.type === 'fleet' ? -1 : 1;
            return b.available - a.available;
        });

        for (var ak = 0; ak < assetCandidates.length && (sources.length + fleetIds.length) < maxSupportAssets; ak++) {
            var asset = assetCandidates[ak];
            if (asset.available <= 0) continue;
            if (asset.type === 'node') sources.push(asset.id);
            else fleetIds.push(asset.id);
            total += asset.available;
            if (total >= needed) break;
        }
        if (!sources.length && !fleetIds.length) continue;
        var opportunityRatio = aiOpportunityRatio;
        if (target.humanOwned) opportunityRatio = Math.max(0.4, opportunityRatio - 0.04);
        if (target.humanCapital) opportunityRatio = Math.max(0.34, opportunityRatio - 0.08);
        if (protectedByTurret) opportunityRatio = Math.max(opportunityRatio, incomingFriendly > 0 ? 1.05 : 1.0);
        if (target.territory.hostile && targetNode.owner !== -1 && !target.humanCapital) opportunityRatio = Math.max(opportunityRatio, 0.58);
        if (target.localEnemyPressure > target.localFriendlyPressure * 1.08) {
            opportunityRatio = Math.min(0.98, opportunityRatio + 0.08);
        } else if (target.territory.friendlySafe) {
            opportunityRatio = Math.max(0.36, opportunityRatio - 0.04);
        } else if (target.territory.contested) {
            opportunityRatio = Math.max(0.38, opportunityRatio - 0.02);
        }
        if (total < needed * opportunityRatio && targetNode.owner !== -1) {
            attemptStagePush(target, targetNode, Math.max(needed - total, needed * 0.4));
            continue;
        }

        var pctMax = capPressure > 0.9 ? Math.max(aiCommitMax, 0.92) : aiCommitMax;
        if (target.humanOwned) pctMax = Math.max(pctMax, aiCriticalCommitMax - 0.04);
        if (target.humanCapital) pctMax = Math.max(pctMax, aiCriticalCommitMax);
        if (targetNode.kind === 'turret') pctMax = Math.max(pctMax, Math.min(1, aiCriticalCommitMax));
        pctMax = Math.min(1, pctMax);
        var pctMin = target.humanCapital ? 0.42 : (target.humanOwned ? 0.35 : 0.3);
        if (targetNode.kind === 'turret') pctMin = Math.max(pctMin, 0.58);
        var pct = clamp(needed / Math.max(total, 1), pctMin, pctMax);
        if (target.humanCapital && myPower >= humanPower * 0.9) pct = Math.max(pct, pctMax * 0.92);
        if (capPressure > 0.95) pct = Math.max(pct, 0.72);
        var predictedBurst = estimateBurstUnits(sources, fleetIds, pct);
        if (protectedByTurret) {
            var burstFloor = Math.max(turretSiegeMinBurst, Math.min(72, needed * (targetNode.kind === 'turret' ? 1.02 : 0.96)));
            if (predictedBurst < burstFloor || predictedBurst + incomingFriendly < burstFloor) {
                attemptStagePush(target, targetNode, Math.max(burstFloor - incomingFriendly - predictedBurst, needed * 0.35));
                continue;
            }
        }

        var flowGate = ((state.tick + targetNode.id * 3 + playerIndex * 7) % aiFlowPeriod) === 0;
        var flowSource = sources.length ? state.nodes[sources[0]] : null;
        var shouldFlow = profile.flow > 0.75 &&
            !state.flows.some(function (flow) { return flow.owner === playerIndex && flow.tgtId === targetNode.id && flow.active; }) &&
            flowSource &&
            canDispatchAI(flowSource, targetNode) &&
            !protectedByTurret &&
            (!target.territory.hostile || target.humanCapital || targetNode.gate) &&
            (target.humanCapital || (flowGate && ((target.humanOwned && targetNode.units > 8) || (targetNode.owner !== -1 && targetNode.units > 12) || targetNode.encounterType === 'relay_core')));
        if (shouldFlow) commands.push({ type: 'flow', data: { srcId: sources[0], tgtId: targetNode.id } });
        commands.push({ type: 'send', data: { sources: sources, fleetIds: fleetIds, tgtId: targetNode.id, pct: pct } });
        markCommittedAssets(sources, fleetIds, pct);
    }

    var upgradeGate = ((state.tick + playerIndex * 11) % aiUpgradePeriod) === 0;
    if (upgradeGate && profile.upg > 0.4) {
        var upgradeNode = null;
        var upgradeScore = -1;
        for (var ui = 0; ui < own.length; ui++) {
            var ownNode = own[ui];
            if ((Number(ownNode.level) || 1) >= SIM_CONSTANTS.NODE_LEVEL_MAX) continue;
            var cost = upgradeCost(ownNode);
            var availableUnits = availableNodeUnits(ownNode);
            if (availableUnits < cost + 6) continue;
            var territoryState = territoryStateForPoint(ownNode.pos);
            var scoreValue = availableUnits - cost + (ownNode.kind === 'forge' ? 12 : 0) + (ownNode.kind === 'relay' ? 8 : 0);
            if (!territoryState.friendlySafe) scoreValue -= 10;
            if (scoreValue > upgradeScore) {
                upgradeScore = scoreValue;
                upgradeNode = ownNode;
            }
        }
        if (upgradeNode) commands.push({ type: 'upgrade', data: { nodeId: upgradeNode.id } });
    }

    var defenseCommands = 0;
    for (var di = 0; di < own.length && defenseCommands < 2; di++) {
        var defenseNode = own[di];
        var pulseHold = strategicPulseAppliesToNode(state, defenseNode.id);
        var shouldFortify = !defenseNode.defense && (
            (!isNodeAssimilated(defenseNode) && defenseNode.units < defenseNode.maxUnits * 0.72) ||
            (pulseHold && defenseNode.units < defenseNode.maxUnits * 0.78) ||
            (defenseNode.gate && defenseNode.units < defenseNode.maxUnits * 0.62)
        );
        if (shouldFortify) {
            commands.push({ type: 'toggleDefense', data: { nodeId: defenseNode.id } });
            defenseCommands++;
            continue;
        }
        var shouldReleaseDefense = defenseNode.defense &&
            isNodeAssimilated(defenseNode) &&
            !pulseHold &&
            !defenseNode.gate &&
            defenseNode.kind !== 'bulwark' &&
            defenseNode.units > defenseNode.maxUnits * 0.8;
        if (shouldReleaseDefense) {
            commands.push({ type: 'toggleDefense', data: { nodeId: defenseNode.id } });
            defenseCommands++;
        }
    }

    for (var fi = 0; fi < state.flows.length; fi++) {
        var flow = state.flows[fi];
        if (flow.owner !== playerIndex || !flow.active) continue;
        var flowTarget = state.nodes[flow.tgtId];
        if (!flowTarget || flowTarget.owner === playerIndex) commands.push({ type: 'rmFlow', data: { srcId: flow.srcId, tgtId: flow.tgtId } });
    }

    if (canActivateDoctrine(state.doctrines, state.doctrineStates, playerIndex)) {
        var shouldTriggerDoctrine = false;
        if (doctrineId === 'siege') {
            shouldTriggerDoctrine = targets.length > 0 && (
                state.nodes[targets[0].id].kind === 'turret' ||
                state.nodes[targets[0].id].defense === true ||
                targets[0].humanCapital
            );
        } else if (doctrineId === 'assimilation') {
            shouldTriggerDoctrine = own.some(function (node) {
                return node && node.owner === playerIndex && !isNodeAssimilated(node);
            });
        } else {
            shouldTriggerDoctrine = capPressure > 0.86 || holdingAssets.length >= 2 || state.flows.some(function (flow) {
                return flow && flow.owner === playerIndex && flow.active;
            });
        }
        if (shouldTriggerDoctrine) commands.unshift({ type: 'activateDoctrine', data: {} });
    }

    return commands;
}
