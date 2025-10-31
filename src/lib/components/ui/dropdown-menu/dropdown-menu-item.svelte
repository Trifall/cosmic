<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		inset,
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean;
	} = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	class={cn(
		'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
		'ring-sidebar-ring',
		'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
		'data-[highlighted]:bg-muted data-[highlighted]:text-primary',
		'data-[highlighted]:font-medium',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		'focus-visible:ring-2',
		'[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
		inset && 'pl-8',
		className
	)}
	{...restProps}
/>
