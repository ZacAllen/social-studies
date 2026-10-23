import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: true
	},
	kit: {
		adapter: adapter({ fallback: '404.html' }),
		paths: {
			// GitHub Pages serves the site from /<repo-name>/
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
