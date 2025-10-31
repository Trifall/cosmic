import type { Attachment } from 'svelte/attachments';
import { type VariantProps, tv } from 'tailwind-variants';
import tippy, { type Props as TippyProps } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { cn } from '$lib/utils.js';

export const tooltipVariants = tv({
	base: [
		// Positioning and size
		'z-50 max-w-xs',

		// Appearance
		'rounded-md border-0 !bg-zinc-600 !text-zinc-100',
		'!px-0.25 !py-0.25 !text-sm !font-normal',
		'!shadow-md',

		// Animation
		'animate-in fade-in-0 zoom-in-95',
		'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
		'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
		'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',

		// Arrow styling
		'[&>.tippy-arrow]:text-zinc-700',
		'[&>.tippy-arrow[data-placement^=top]::before]:border-t-current',
		'[&>.tippy-arrow[data-placement^=bottom]::before]:border-b-current',
		'[&>.tippy-arrow[data-placement^=left]::before]:border-l-current',
		'[&>.tippy-arrow[data-placement^=right]::before]:border-r-current',

		// Animation origin
		'[&[data-animation=scale]]:transition-all [&[data-animation=scale]]:duration-100 [&[data-animation=scale]]:ease-out',
		'[&[data-animation=scale][data-placement^=top]]:origin-bottom',
		'[&[data-animation=scale][data-placement^=bottom]]:origin-top',
		'[&[data-animation=scale][data-placement^=left]]:origin-right',
		'[&[data-animation=scale][data-placement^=right]]:origin-left',
		'[&[data-animation=scale][data-state=hidden]]:scale-90 [&[data-animation=scale][data-state=hidden]]:opacity-0',
	].join(' '),
	variants: {
		variant: {
			default: [
				'border-0 !bg-zinc-600 !text-black dark:!text-white hover:bg-secondary/40',
				'[&>.tippy-arrow]:text-zinc-600',
			].join(' '),
			primary: [
				'border-0 !bg-primary !text-primary-foreground hover:bg-primary/40',
				'[&>.tippy-arrow]:text-primary',
			].join(' '),
			destructive: [
				'border-destructive !bg-destructive !text-destructive-foreground',
				'[&>.tippy-arrow]:text-destructive',
			].join(' '),
		},
	},
	defaultVariants: {
		variant: 'default',
	},
});

export type TooltipVariant = VariantProps<typeof tooltipVariants>['variant'];

/**
 * Options for the tooltip attachment
 */
export type TooltipOptions = Partial<TippyProps> & {
	content: string;
	variant?: TooltipVariant;
	className?: string;
};

declare module 'svelte/elements' {
	interface SvelteHTMLElements {
		'tooltip:attach': {
			tooltip: typeof tooltip;
		};
	}
}

/**
 * Creates a tooltip attachment that can be used with the @attach syntax
 *
 * @example
 * ```svelte
 * <!-- Basic usage -->
 * <button {@attach tooltip('Hello world')}>Hover me</button>
 *
 * <!-- With options -->
 * <button {@attach tooltip({ content: 'Hello world', placement: 'right' })}>Right tooltip</button>
 *
 * <!-- With variant -->
 * <button {@attach tooltip({ content: 'Primary tooltip', variant: 'primary' })}>Primary</button>
 * ```
 */
export const tooltip = (options: TooltipOptions | string): Attachment => {
	const config = typeof options === 'string' ? { content: options } : options;

	const variant = config.variant || 'default';
	const className = config.className || '';

	return (node) => {
		// Apply the tailwind variants to the tooltip
		const instance = tippy(node, {
			// Default options
			animation: 'scale',
			arrow: true,
			placement: 'top',
			duration: [200, 150], // [show, hide] durations in ms
			delay: [0, 50], // [show, hide] delays in ms
			theme: variant, // Use the variant as the theme
			allowHTML: true, // Allow HTML in the tooltip content
			appendTo: document.body, // Append to body to avoid positioning issues
			...config,
			onMount(instance) {
				// Apply tailwind variants to the tooltip box
				const box = instance.popper.querySelector('.tippy-box');
				if (box) {
					box.className = cn(box.className, tooltipVariants({ variant }), className);
				}
			},
		});

		// Return cleanup function
		return () => {
			instance.destroy();
		};
	};
};
