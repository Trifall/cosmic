<script lang="ts">
	import { getPublicSiteName } from '$src/lib/utils/format.js';
	import SignIn from '$components/auth/signin.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Sign In - {getPublicSiteName()}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div class="flex flex-col gap-2">
		<SignIn redirectTo={data.redirectPath} />
		<!-- <Button
				type="button"
				onclick={() =>
					authClient.signIn.social({ provider: 'discord', callbackURL: data.redirectPath })}
				variant="outline"
				size="lg"
			>
				Sign in with Discord
			</Button>
			<Button
				type="button"
				onclick={() =>
					authClient.signIn.social({ provider: 'github', callbackURL: data.redirectPath })}
				variant="outline"
				size="lg"
			>
				Sign in with GitHub
			</Button>
			<Button
				type="button"
				onclick={() =>
					authClient.signIn.social({ provider: 'google', callbackURL: data.redirectPath })}
				variant="outline"
				size="lg"
			>
				Sign in with Google
			</Button> -->
	</div>
</div>
