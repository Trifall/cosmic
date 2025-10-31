<script lang="ts">
	import { getPublicSiteName } from '$src/lib/utils/format';
	import SignUp from '$components/auth/signup.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Sign Up - {getPublicSiteName()}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div class="flex flex-col gap-2">
		<SignUp isPublicRegistrationEnabled={data.isPublicRegistrationEnabled} />
	</div>
</div>
