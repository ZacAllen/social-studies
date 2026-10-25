import { error } from '@sveltejs/kit';
import { getSubject, subjects } from '$lib/content';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => subjects.map((s) => ({ slug: s.slug }));

export const load: PageLoad = ({ params }) => {
	const subject = getSubject(params.slug);
	if (!subject) error(404, 'Subject not found');
	return { subject };
};
