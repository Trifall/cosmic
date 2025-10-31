import { env } from '$env/dynamic/public';
import { adminClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';
import { toast } from 'svelte-sonner';

export const authClient = createAuthClient({
	baseURL: env.PUBLIC_WEB_UI_URL,
	plugins: [usernameClient(), adminClient()],
	fetchOptions: {
		onError: async (context) => {
			const { response } = context;
			if (response.status === 429) {
				const retryAfter = response.headers.get('X-Retry-After');
				if (retryAfter) {
					toast.error(`Rate Limited. Please try again in ${retryAfter} seconds.`);
				}
			}
		},
	},
});
