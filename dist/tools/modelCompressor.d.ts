export interface ModelCompressorArgs {
    action: 'estimate' | 'recommend' | 'list_algos' | 'list_models' | 'generate_config';
    param_billions?: number;
    weight_bits?: number;
    act_bits?: number;
    kv_bits?: number;
    model_type?: string;
    available_vram_gb?: number;
    optimization_goal?: 'balanced' | 'maximum_throughput' | 'minimum_vram' | 'highest_accuracy';
    model_path?: string;
    method?: string;
    backend?: 'vllm' | 'sglang' | 'autoawq' | 'lightllm' | 'fake_quant' | 'lightx2v';
    project_path?: string;
}
export declare function handleModelCompressor(args: any): string;
//# sourceMappingURL=modelCompressor.d.ts.map