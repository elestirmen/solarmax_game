import { doctrineName } from '../sim/doctrine.js';
import { playlistName } from '../sim/playlists.js';

export function resolveMissionDefinition(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var dailyChallenge = opts.dailyActive && opts.dailyChallenge ? opts.dailyChallenge : null;
    if (dailyChallenge) return dailyChallenge;

    var campaignLevels = Array.isArray(opts.campaignLevels) ? opts.campaignLevels : [];
    if (opts.campaignActive && Number.isFinite(opts.campaignLevelIndex) && opts.campaignLevelIndex >= 0) {
        return campaignLevels[opts.campaignLevelIndex] || null;
    }

    if (Array.isArray(opts.objectives) && opts.objectives.length) {
        return {
            name: 'Hedef Maci',
            title: 'Hedef Maci',
            blurb: '',
            playlist: opts.playlist || 'standard',
            doctrineId: opts.humanDoctrineId || opts.doctrineId || '',
            objectives: opts.objectives,
            endOnObjectives: opts.endOnObjectives === true,
        };
    }

    return null;
}

export function resolveMissionMode(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (opts.dailyActive && opts.dailyChallenge) return 'daily';
    if (opts.campaignActive && Number.isFinite(opts.campaignLevelIndex) && opts.campaignLevelIndex >= 0) return 'campaign';
    if (Array.isArray(opts.objectives) && opts.objectives.length) return 'objective';
    return '';
}

export function buildMissionPanelTitle(level, mode) {
    if (!level) return 'Misyon';
    if (mode === 'daily') return 'Gunluk Challenge';
    if (mode === 'campaign') return 'Bolum ' + level.id + ': ' + level.name;
    return level.title || level.name || 'Misyon';
}

export function buildMissionPanelSubtitle(opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    var level = opts.level;
    var mode = opts.mode || '';
    if (!level) return '';

    if (mode === 'daily') {
        var dailyBits = [];
        dailyBits.push(level.title || 'Gunluk');
        dailyBits.push(level.blurb || '');
        if (level.playlist) dailyBits.push('Playlist: ' + playlistName(level.playlist));
        if (level.doctrineId) dailyBits.push('Doktrin: ' + doctrineName(level.doctrineId));
        if (opts.dailyCompleted) dailyBits.push('Durum: Tamamlandi');
        else if ((Number(opts.dailyBestTick) || 0) > 0) dailyBits.push('En iyi: ' + opts.dailyBestTick + ' tick');
        return dailyBits.filter(Boolean).join(' | ');
    }

    var subtitleParts = [level.blurb || ''];
    if (level.playlist) subtitleParts.push('Playlist: ' + playlistName(level.playlist));
    if (level.doctrineId) subtitleParts.push('Doktrin: ' + doctrineName(level.doctrineId));
    return subtitleParts.filter(Boolean).join(' | ');
}

export function pickPrimaryObjectiveRow(rows) {
    var list = Array.isArray(rows) ? rows : [];
    var i = 0;
    for (i = 0; i < list.length; i++) {
        if (list[i] && !list[i].complete && !list[i].failed && !list[i].optional) return list[i];
    }
    for (i = 0; i < list.length; i++) {
        if (list[i] && !list[i].complete && !list[i].failed) return list[i];
    }
    return null;
}
