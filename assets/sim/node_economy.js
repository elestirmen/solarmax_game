export function stepNodeEconomy(params) {
    params = params || {};

    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var powerByPlayer = params.powerByPlayer || {};
    var supplyByPlayer = params.supplyByPlayer || {};
    var ownerUnits = params.ownerUnits || {};
    var ownerCaps = params.ownerCaps || {};
    var tune = params.tune || {};
    var diffCfg = params.diffCfg || {};
    var rules = params.rules || {};
    var stats = params.stats || {};
    var callbacks = params.callbacks || {};
    var constants = params.constants || {};
    var humanIndex = Number(params.humanIndex);

    var clamp = typeof callbacks.clamp === 'function' ? callbacks.clamp : function (value, min, max) {
        return Math.max(min, Math.min(max, value));
    };
    var nodeTypeOf = typeof callbacks.nodeTypeOf === 'function' ? callbacks.nodeTypeOf : function () {
        return { prod: 1, def: 1 };
    };
    var nodeCapacity = typeof callbacks.nodeCapacity === 'function' ? callbacks.nodeCapacity : function (node) {
        return Number(node && node.maxUnits) || 0;
    };
    var nodeLevelProdMult = typeof callbacks.nodeLevelProdMult === 'function' ? callbacks.nodeLevelProdMult : function () {
        return 1;
    };
    var strategicPulseAppliesToNode = typeof callbacks.strategicPulseAppliesToNode === 'function' ? callbacks.strategicPulseAppliesToNode : function () {
        return false;
    };
    var isNodeAssimilated = typeof callbacks.isNodeAssimilated === 'function' ? callbacks.isNodeAssimilated : function () {
        return true;
    };
    var ownerProdMultiplier = typeof callbacks.ownerProdMultiplier === 'function' ? callbacks.ownerProdMultiplier : function () {
        return 1;
    };
    var ownerAssimilationMultiplier = typeof callbacks.ownerAssimilationMultiplier === 'function' ? callbacks.ownerAssimilationMultiplier : function () {
        return 1;
    };

    var baseProd = Number(constants.baseProd);
    var nodeRadiusMax = Number(constants.nodeRadiusMax);
    var isolatedProdPenalty = Number(constants.isolatedProdPenalty);
    var capSoftStart = Number(constants.capSoftStart);
    var capSoftFloor = Number(constants.capSoftFloor);
    var ddaMaxBoost = Number(constants.ddaMaxBoost);
    var defenseProdPenalty = Number(constants.defenseProdPenalty);
    var strategicPulseProd = Number(constants.strategicPulseProd);
    var strategicPulseAssim = Number(constants.strategicPulseAssim);
    var defenseAssimBonus = Number(constants.defenseAssimBonus);
    var assimBaseRate = Number(constants.assimBaseRate);
    var assimUnitBonus = Number(constants.assimUnitBonus);
    var assimGarrisonFloor = Number(constants.assimGarrisonFloor);
    var assimLevelResist = Number(constants.assimLevelResist);

    if (!Number.isFinite(baseProd)) baseProd = 0.12;
    if (!Number.isFinite(nodeRadiusMax) || nodeRadiusMax <= 0) nodeRadiusMax = 36;
    if (!Number.isFinite(isolatedProdPenalty)) isolatedProdPenalty = 0.6;
    if (!Number.isFinite(capSoftStart)) capSoftStart = 0.82;
    if (!Number.isFinite(capSoftFloor)) capSoftFloor = 0.12;
    if (!Number.isFinite(ddaMaxBoost)) ddaMaxBoost = 0.5;
    if (!Number.isFinite(defenseProdPenalty)) defenseProdPenalty = 1;
    if (!Number.isFinite(strategicPulseProd)) strategicPulseProd = 1;
    if (!Number.isFinite(strategicPulseAssim)) strategicPulseAssim = 1;
    if (!Number.isFinite(defenseAssimBonus)) defenseAssimBonus = 1;
    if (!Number.isFinite(assimBaseRate)) assimBaseRate = 0;
    if (!Number.isFinite(assimUnitBonus)) assimUnitBonus = 0;
    if (!Number.isFinite(assimGarrisonFloor)) assimGarrisonFloor = 0;
    if (!Number.isFinite(assimLevelResist)) assimLevelResist = 0;

    var totalProduced = 0;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!node || node.owner < 0) continue;

        var nodeType = nodeTypeOf(node);
        node.maxUnits = nodeCapacity(node);
        if (node.units > node.maxUnits) node.units = node.maxUnits;
        if ((node.assimilationLock || 0) > 0) node.assimilationLock = Math.max(0, node.assimilationLock - 1);

        if (node.assimilationProgress !== undefined && node.assimilationProgress < 1) {
            if ((node.assimilationLock || 0) <= 0) {
                var garrisonRatio = clamp(node.units / Math.max(1, node.maxUnits), 0, 1);
                var garrisonFactor = assimGarrisonFloor + (1 - assimGarrisonFloor) * garrisonRatio;
                var levelResist = 1 + Math.max(0, node.level - 1) * assimLevelResist;
                var typeResist = 0.85 + (Number(nodeType.def) || 0) * 0.4;
                var assimRate = (assimBaseRate + Math.floor(node.units) * assimUnitBonus) * garrisonFactor / (levelResist * typeResist);
                if (node.defense) assimRate *= defenseAssimBonus;
                if (strategicPulseAppliesToNode(node.id)) assimRate *= strategicPulseAssim;
                assimRate *= Math.max(0.2, Number(ownerAssimilationMultiplier(node.owner, node)) || 1);
                node.assimilationProgress = Math.min(1, (node.assimilationProgress || 0) + assimRate);
            }
        }

        var assimilated = isNodeAssimilated(node);
        if (!assimilated) {
            node.supplied = false;
            continue;
        }

        var ownerAssist = 0;
        if (node.owner !== humanIndex && tune.aiAssist) {
            var delta = (powerByPlayer[humanIndex] || 0) - (powerByPlayer[node.owner] || 0);
            ownerAssist = clamp(delta / 950, 0, ddaMaxBoost);
        }

        var diffMult = node.owner === humanIndex ? Number(diffCfg.humanProdMult) || 1 : Number(diffCfg.aiProdMult) || 1;
        var linkedNodes = supplyByPlayer[node.owner];
        var supplyMult = linkedNodes && typeof linkedNodes.has === 'function' && linkedNodes.has(node.id) ? 1 : isolatedProdPenalty;
        var defenseMult = node.defense ? defenseProdPenalty : 1;
        var ownerCap = Number(ownerCaps[node.owner]) || 0;
        var ownerUnitCount = Number(ownerUnits[node.owner]) || 0;
        var capPressureNow = ownerCap > 0 ? ownerUnitCount / ownerCap : 0;
        var capProdMult = 1;
        if (capPressureNow > capSoftStart) {
            var capPhase = clamp((capPressureNow - capSoftStart) / Math.max(0.0001, 1 - capSoftStart), 0, 1);
            capProdMult = clamp(1 - capPhase * (1 - capSoftFloor), capSoftFloor, 1);
        }

        if (rules && rules.applyExtraPenalties === false) {
            supplyMult = 1;
            defenseMult = 1;
        }

        node.supplied = supplyMult === 1;
        if (node.kind === 'turret') {
            node.prodAcc = 0;
            continue;
        }
        if (ownerUnitCount >= ownerCap) continue;

        var prodMult = strategicPulseAppliesToNode(node.id) ? strategicPulseProd : 1;
        prodMult *= Math.max(0.2, Number(ownerProdMultiplier(node.owner, node)) || 1);
        var prodAcc = Number(node.prodAcc) || 0;
        prodAcc += baseProd * (Number(tune.prod) || 1) * ((Number(node.radius) || 0) / nodeRadiusMax) * (Number(nodeType.prod) || 1) * nodeLevelProdMult(node) * (1 + ownerAssist) * diffMult * supplyMult * defenseMult * capProdMult * prodMult;
        node.prodAcc = prodAcc;

        if (node.prodAcc >= 1) {
            var accInt = Math.floor(node.prodAcc);
            var nodeRoom = Math.max(0, Math.floor(node.maxUnits - node.units));
            var capRoom = Math.max(0, ownerCap - ownerUnitCount);
            var produced = Math.min(accInt, nodeRoom, capRoom);
            if (produced > 0) {
                node.units += produced;
                ownerUnits[node.owner] = ownerUnitCount + produced;
                totalProduced += produced;
            }
            node.prodAcc -= accInt;
        }
    }

    if (stats) {
        stats.unitsProduced = (Number(stats.unitsProduced) || 0) + totalProduced;
    }

    return {
        nodes: nodes,
        ownerUnits: ownerUnits,
        ownerCaps: ownerCaps,
        totalProduced: totalProduced,
    };
}
