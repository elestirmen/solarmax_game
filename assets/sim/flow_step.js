export function stepFlowLinks(params) {
    params = params || {};

    var flows = Array.isArray(params.flows) ? params.flows : [];
    var nodes = Array.isArray(params.nodes) ? params.nodes : [];
    var constants = params.constants || {};

    var flowInterval = Number(params.flowInterval);
    var flowFraction = Number(constants.flowFraction);
    var minReserve = Number(constants.minReserve);
    var defenseFlowMult = Number(constants.defenseFlowMult);
    if (!Number.isFinite(flowInterval) || flowInterval < 1) flowInterval = 1;
    if (!Number.isFinite(flowFraction) || flowFraction <= 0) flowFraction = 0.08;
    if (!Number.isFinite(minReserve) || minReserve < 0) minReserve = 2;
    if (!Number.isFinite(defenseFlowMult) || defenseFlowMult <= 0) defenseFlowMult = 1;

    var dispatches = [];
    for (var i = 0; i < flows.length; i++) {
        var flow = flows[i];
        if (!flow || !flow.active) continue;

        var src = nodes[flow.srcId];
        var tgt = nodes[flow.tgtId];
        if (!src || !tgt) {
            flow.active = false;
            continue;
        }
        if (src.owner !== flow.owner) {
            flow.active = false;
            continue;
        }

        flow.tickAcc = (Number(flow.tickAcc) || 0) + 1;
        if (flow.tickAcc < flowInterval) continue;

        flow.tickAcc = 0;
        var srcUnits = Number(src.units) || 0;
        var effFrac = flowFraction * (src.defense ? defenseFlowMult : 1);
        var amount = Math.max(1, Math.floor(srcUnits * effFrac));
        if (srcUnits > amount + minReserve) {
            dispatches.push({
                owner: flow.owner,
                srcId: flow.srcId,
                tgtId: flow.tgtId,
                pct: srcUnits > 0 ? amount / srcUnits : 0,
            });
        }
    }

    return {
        flows: flows,
        dispatches: dispatches,
    };
}
