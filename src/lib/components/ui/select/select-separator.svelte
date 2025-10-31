<script lang="ts">
	import type { Separator as SeparatorPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { Separator } from '$components/ui/separator/index.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<Separator bind:ref class={cn('-mx-1 my-1 h-px bg-muted', className)} {...restProps} />
