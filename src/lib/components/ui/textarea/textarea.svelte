<script lang="ts">
	import type { WithElementRef, WithoutChildren } from 'bits-ui';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	interface Props extends WithoutChildren<WithElementRef<HTMLTextareaAttributes>> {
		ref?: HTMLTextAreaElement | null;
		value?: string;
		class?: string;
		enableTabKey?: boolean;
	}

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		enableTabKey = false,
		...restProps
	}: Props = $props();

	// handle tab key in textarea to insert tab character
	const handleKeydown = (event: KeyboardEvent) => {
		if (enableTabKey && event.key === 'Tab') {
			event.preventDefault();
			const target = event.target as HTMLTextAreaElement;
			const start = target.selectionStart;
			const end = target.selectionEnd;

			// insert tab character at cursor position
			if (value !== undefined) {
				value = value.substring(0, start) + '\t' + value.substring(end);

				// move cursor after the inserted tab
				setTimeout(() => {
					target.selectionStart = target.selectionEnd = start + 1;
				}, 0);
			}
		}
	};
</script>

<textarea
	bind:this={ref}
	class={cn(
		'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className
	)}
	bind:value
	onkeydown={handleKeydown}
	{...restProps}
></textarea>
