import { error } from '@sveltejs/kit';
import { getLesson, lessons } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => lessons.map((l) => ({ slug: l.slug }));

export const load: PageLoad = ({ params }) => {
	const lesson = getLesson(params.slug);
	if (!lesson) error(404, 'Lesson not found');
	return { lesson };
};
