<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import Self from './JsonViewer.svelte';

	interface Props {
		data: unknown;
		expanded?: boolean;
		maxDepth?: number;
		currentDepth?: number;
		showRoot?: boolean;
	}

	let {
		data,
		expanded = true,
		maxDepth = 10,
		currentDepth = 0,
		showRoot = false,
	}: Props = $props();

	let isExpanded = $state(expanded && currentDepth < 3); // auto-collapse after 3 levels

	const getType = (value: unknown): string => {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		return typeof value;
	};

	const isExpandable = (value: unknown): boolean => {
		return (
			(typeof value === 'object' && value !== null && Object.keys(value).length > 0) ||
			(Array.isArray(value) && value.length > 0)
		);
	};

	const formatPrimitive = (value: unknown): string => {
		if (value === null) return 'null';
		if (typeof value === 'string') {
			return value === '' ? '"" (empty string)' : `"${value}"`;
		}
		if (typeof value === 'boolean') return value.toString();
		if (typeof value === 'number') return value.toString();
		if (typeof value === 'undefined') return 'undefined';
		// handle empty arrays and objects as inline primitives
		if (Array.isArray(value) && value.length === 0) return '[]';
		if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return '{}';
		// this should never be reached for objects/arrays in normal flow
		// but just in case, return a proper JSON representation
		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value);
		}
		return String(value);
	};

	const getValueClass = (value: unknown): string => {
		const type = getType(value);
		switch (type) {
			case 'string':
				return 'text-green-600 dark:text-green-400';
			case 'number':
				return 'text-blue-600 dark:text-blue-400';
			case 'boolean':
				return 'text-purple-600 dark:text-purple-400';
			case 'null':
				return 'text-gray-500 dark:text-gray-400';
			case 'array':
			case 'object':
				// empty arrays and objects get orange color
				return 'text-orange-600 dark:text-orange-400';
			default:
				return 'text-gray-900 dark:text-gray-100';
		}
	};
</script>

{#if currentDepth < maxDepth}
	<div class="json-viewer">
		{#if typeof data === 'object' && data !== null}
			{#if Array.isArray(data)}
				<!-- Array -->
				{#if data.length > 0}
					<div class="flex items-center gap-1">
						<button
							onclick={() => (isExpanded = !isExpanded)}
							class="flex items-center gap-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{#if isExpanded}
								<ChevronDown size={16} />
							{:else}
								<ChevronRight size={16} />
							{/if}
						</button>
						<span class="text-gray-600 dark:text-gray-400">
							[{data.length} item{data.length !== 1 ? 's' : ''}]
						</span>
					</div>
				{:else}
					<!-- Empty array -->
					<span class="text-orange-600 dark:text-orange-400">[]</span>
				{/if}

				{#if isExpanded && data.length > 0}
					<div class="ml-4 border-l border-gray-200 pl-4 dark:border-gray-700">
						{#each data as item, index (index)}
							<div class="py-1">
								<span class="text-gray-500 dark:text-gray-400">{index}:</span>
								<Self data={item} {maxDepth} currentDepth={currentDepth + 1} {showRoot} />
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- Object -->
				{@const entries = Object.entries(data)}
				{#if entries.length > 0}
					<div class="flex items-center gap-1">
						<button
							onclick={() => (isExpanded = !isExpanded)}
							class="flex items-center gap-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
						>
							{#if isExpanded}
								<ChevronDown size={16} />
							{:else}
								<ChevronRight size={16} />
							{/if}
						</button>
						<span class="text-gray-600 dark:text-gray-400">
							{entries.length} propert{entries.length !== 1 ? 'ies' : 'y'}
						</span>
					</div>
				{:else}
					<!-- Empty object -->
					<span class="text-orange-600 dark:text-orange-400">{'{}'}</span>
				{/if}

				{#if isExpanded && entries.length > 0}
					<div class="ml-4 border-l border-gray-200 pl-4 dark:border-gray-700">
						{#each entries as [key, value] (key)}
							<div class="py-1">
								<span class="font-medium text-blue-700 dark:text-blue-300">"{key}"</span>
								<span class="text-gray-500 dark:text-gray-400">:</span>
								{#if isExpandable(value)}
									<Self data={value} {maxDepth} currentDepth={currentDepth + 1} {showRoot} />
								{:else}
									<span class={getValueClass(value)}>
										{formatPrimitive(value)}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Primitive value -->
			<span class={getValueClass(data)}>
				{formatPrimitive(data)}
			</span>
		{/if}
	</div>
{:else}
	<span class="italic text-gray-500 dark:text-gray-400">... (max depth reached)</span>
{/if}

<style>
	.json-viewer {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}
</style>
