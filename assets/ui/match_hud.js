export function buildHudTickText(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var text = 'Tick: ' + Math.floor(Number(opts.tick) || 0) + ' | ' + (opts.diff || '');
    if (!opts.pulseActive) return text;

    var pulseOwner = Math.floor(Number(opts.pulseOwner));
    var ownerText = pulseOwner < 0 ? 'Tarafsız' : (pulseOwner === Math.floor(Number(opts.humanIndex) || 0) ? 'Sen' : ('P' + (pulseOwner + 1)));
    var secondsLeft = Math.max(1, Math.ceil((Number(opts.pulseRemainingTicks) || 0) / 30));
    return text + ' | Pulse: ' + ownerText + ' ' + secondsLeft + 's';
}

export function buildHudCapText(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var units = Math.floor(Number(opts.units) || 0);
    var cap = Math.floor(Number(opts.cap) || 0);
    var pressure = cap > 0 ? units / cap : 0;
    var text = 'Cap ' + units + '/' + cap;
    if (pressure > Number(opts.strainThreshold || 0.82)) {
        text += ' | Strain ' + Math.round(pressure * 100) + '%';
    }
    return text;
}

export function buildDoctrineButtonState(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!opts.doctrineId) {
        return {
            disabled: true,
            text: 'DOK',
            title: 'Doktrin seçilmedi',
            help: 'Bu maçta doktrin yüklemesi yok.',
            helpDisabled: 'Bu maçta doktrin yüklemesi yok.',
        };
    }

    var label = (opts.doctrineName || opts.doctrineId) + ' | ' + (opts.doctrineStatus || '');
    return {
        disabled: !opts.ready,
        text: 'DOK',
        title: label,
        help: label + ' — Kısayol: Q',
        helpDisabled: label + ' — henüz hazır değil',
    };
}

export function buildPingDisplayText(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var text = opts.online && opts.lastPingMs !== undefined ? ('Ping: ' + Math.round(Number(opts.lastPingMs) || 0) + 'ms') : '';
    var showSync = !!(opts.online && opts.syncWarningText && ((Math.floor(Number(opts.currentTick) || 0) - Math.floor(Number(opts.syncWarningTick) || 0)) < Math.floor(Number(opts.syncWindowTicks) || 0)));
    if (showSync) text += (text ? ' | ' : '') + 'SYNC';
    return text;
}
