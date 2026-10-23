import { browser } from '$app/environment';

export interface LessonResult {
	best: number;
	total: number;
	attempts: number;
}

const KEY = 'social-studies:progress:v1';

function load(): Record<string, LessonResult> {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}');
	} catch {
		return {};
	}
}

/** Completed lessons and best quiz scores, kept in this browser only. */
class Progress {
	results = $state<Record<string, LessonResult>>(load());

	record(slug: string, score: number, total: number) {
		const prev = this.results[slug];
		this.results[slug] = {
			best: Math.max(prev?.best ?? 0, score),
			total,
			attempts: (prev?.attempts ?? 0) + 1
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(this.results));
		} catch {
			// Private mode or storage full: progress just won't persist.
		}
	}
}

export const progress = new Progress();
