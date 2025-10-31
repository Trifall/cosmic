<script lang="ts">
	interface Props {
		// visual size of the spinner in pixels
		size?: number;
		// optional label shown below the spinner
		label?: string | null;
		// extra classes for outer container
		class?: string;
		// class for the label text
		labelClass?: string;
	}

	let {
		size = 48,
		label = 'Loading...',
		class: className = '',
		labelClass = 'text-sm text-muted-foreground',
	}: Props = $props();
</script>

<div
	class={'flex flex-col items-center justify-center gap-2 text-muted-foreground ' +
		(className ?? '')}
>
	<div
		class="sk-circle relative"
		style="width: {size}px; height: {size}px;"
		role="status"
		aria-label={typeof label === 'string' ? label : 'Loading'}
	>
		<div class="sk-child sk-circle1 absolute left-0 top-0 h-full w-full"></div>
		<div class="sk-child sk-circle2 absolute left-0 top-0 h-full w-full rotate-[30deg]"></div>
		<div class="sk-child sk-circle3 absolute left-0 top-0 h-full w-full rotate-[60deg]"></div>
		<div class="sk-child sk-circle4 absolute left-0 top-0 h-full w-full rotate-[90deg]"></div>
		<div class="sk-child sk-circle5 absolute left-0 top-0 h-full w-full rotate-[120deg]"></div>
		<div class="sk-child sk-circle6 absolute left-0 top-0 h-full w-full rotate-[150deg]"></div>
		<div class="sk-child sk-circle7 absolute left-0 top-0 h-full w-full rotate-[180deg]"></div>
		<div class="sk-child sk-circle8 absolute left-0 top-0 h-full w-full rotate-[210deg]"></div>
		<div class="sk-child sk-circle9 absolute left-0 top-0 h-full w-full rotate-[240deg]"></div>
		<div class="sk-child sk-circle10 absolute left-0 top-0 h-full w-full rotate-[270deg]"></div>
		<div class="sk-child sk-circle11 absolute left-0 top-0 h-full w-full rotate-[300deg]"></div>
		<div class="sk-child sk-circle12 absolute left-0 top-0 h-full w-full rotate-[330deg]"></div>
	</div>
	{#if label}
		<div class={labelClass}>{label}</div>
	{/if}
</div>

<style>
	.sk-child:before {
		content: '';
		display: block;
		margin: 0 auto;
		width: 15%;
		height: 15%;
		background-color: currentColor;
		border-radius: 100%;
		animation: sk-circleBounceDelay 1.2s infinite ease-in-out both;
	}

	.sk-circle2:before {
		animation-delay: -1.1s;
	}
	.sk-circle3:before {
		animation-delay: -1s;
	}
	.sk-circle4:before {
		animation-delay: -0.9s;
	}
	.sk-circle5:before {
		animation-delay: -0.8s;
	}
	.sk-circle6:before {
		animation-delay: -0.7s;
	}
	.sk-circle7:before {
		animation-delay: -0.6s;
	}
	.sk-circle8:before {
		animation-delay: -0.5s;
	}
	.sk-circle9:before {
		animation-delay: -0.4s;
	}
	.sk-circle10:before {
		animation-delay: -0.3s;
	}
	.sk-circle11:before {
		animation-delay: -0.2s;
	}
	.sk-circle12:before {
		animation-delay: -0.1s;
	}

	@keyframes sk-circleBounceDelay {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
