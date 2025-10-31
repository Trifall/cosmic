import { Tooltip as TooltipPrimitive } from 'bits-ui';
import { type TooltipVariant, tooltip, tooltipVariants } from './tooltip';
import Content from './tooltip-content.svelte';

const Root = TooltipPrimitive.Root;
const Trigger = TooltipPrimitive.Trigger;
const Provider = TooltipPrimitive.Provider;

export {
	Content,
	Provider,
	Root,
	tooltip,
	//
	Root as Tooltip,
	Content as TooltipContent,
	Provider as TooltipProvider,
	Trigger as TooltipTrigger,
	tooltipVariants,
	Trigger,
};

export type { TooltipVariant };
