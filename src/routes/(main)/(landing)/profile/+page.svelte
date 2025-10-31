<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import ProfileDisplay from '$lib/components/ProfileDisplay.svelte';
	import { ROUTES } from '$src/lib/routes';
	import { getPublicSiteName } from '$src/lib/utils/format';
	import { Button } from '$components/ui/button';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Your Profile - {getPublicSiteName()}</title>
</svelte:head>

<div class="container mx-auto px-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Your Profile</h1>
		<Button href={ROUTES.HOME}><ArrowLeft />Back to Home</Button>
	</div>

	<ProfileDisplay user={data.user} statistics={data.statistics} error={data.error} />
</div>
