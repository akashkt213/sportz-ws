import type { Match, MatchStatus } from '../db/schema.js';
import { MATCH_STATUS } from '../validation/matches.js';

type DateInput = Date | string;

export function getMatchStatus(
    startTime: DateInput,
    endTime: DateInput | null,
    now: Date = new Date(),
): MatchStatus | null {
    const start = new Date(startTime);
    // A missing end time means the match has no scheduled finish yet; `new Date(null)` would be 1970.
    const end = endTime === null ? null : new Date(endTime);

    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
        return null;
    }

    if (now < start) {
        return MATCH_STATUS.SCHEDULED;
    }

    if (end && now >= end) {
        return MATCH_STATUS.FINISHED;
    }

    return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(
    match: Pick<Match, 'startTime' | 'endTime' | 'status'>,
    updateStatus: (status: MatchStatus) => Promise<unknown>,
): Promise<MatchStatus> {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) {
        return match.status;
    }
    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}
