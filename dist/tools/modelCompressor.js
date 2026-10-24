import { logToolCall } from '../util/log.js';
const QUANT_ALGOS = [
    'AWQ', 'GPTQ', 'SmoothQuant', 'RTN', 'QuaRot', 'QUIK', 'SpQR', 'HQQ',
    'OmniQuant', 'OsPlus', 'AdaDim', 'NormTweaking', 'DGQ', 'TesseraQ',
    'LlmInt8', 'KiviQuantKVCache', 'NaiveQuantKVCache'
];
const SPARSE_ALGOS = [
    'Wanda', 'ShortGPT', 'Magnitude', 'Dense', 'ShadowKVCache', 'SinkKVCache'
];
const TOKEN_REDUCTION_ALGOS = [
    'ToMe', 'FastV', 'FastVID', 'VisionZip', 'PyramidDrop', 'VisPruner',
    'FasterVLM', 'SparseVLM', 'DyCoke', 'MustDrop', 'DART', 'DivPrune',
    'PruneVid', 'HoliTom', 'RandomPrune'
];
const MODEL_FAMILIES = [
    'DeepSeekV3', 'DeepSeekV2', 'DeepSeek-R1', 'Llama', 'Mistral', 'Mixtral',
    'Qwen2', 'Qwen2VL', 'Qwen2_5VL', 'Qwen3', 'Qwen3MoE', 'Gemma2', 'Phi3',
    'InternVL2', 'InternVL3_5', 'MiniCPMV', 'Wan2_2_T2V', 'Wan_I2V', 'Wan_T2V'
];
export function handleModelCompressor(args) {
    const projectPath = args?.project_path || process.cwd();
    logToolCall('model_compressor', args, projectPath);
    const action = args?.action || 'list_algos';
    if (action === 'list_algos') {
        return [
            '# 🗜️ AgentCompress: Supported Algorithms',
            '',
            '## 1. Post-Training Quantization (PTQ)',
            QUANT_ALGOS.map(a => `- **${a}**`).join('\n'),
            '',
            '## 2. Sparsification & Pruning',
            SPARSE_ALGOS.map(a => `- **${a}**`).join('\n'),
            '',
            '## 3. Multimodal Token Reduction (VLMs & LLMs)',
            TOKEN_REDUCTION_ALGOS.map(a => `- **${a}**`).join('\n'),
            '',
            '💡 Run with `action: "recommend"` or `action: "estimate"` for deployment plans.'
        ].join('\n');
    }
    if (action === 'list_models') {
        return [
            '# 🤖 AgentCompress: Supported Model Architectures',
            '',
            MODEL_FAMILIES.map(m => `- **${m}**`).join('\n'),
            '',
            '## Deployment Backends',
            '- **vLLM** (Production high-throughput serving)',
            '- **SGLang** (Fast MoE & structured generation serving)',
            '- **LightLLM** (Lightweight distributed LLM server)',
            '- **AutoAWQ** (HuggingFace AutoAWQ format)',
            '- **TensorRT-LLM** (NVIDIA TensorRT compiled engines)',
            '- **LightX2V** (Ultra-fast video diffusion inference for Wan2.1)'
        ].join('\n');
    }
    if (action === 'estimate') {
        const params = Number(args?.param_billions) || 7.0;
        const wBits = Number(args?.weight_bits) || 4;
        const actBits = Number(args?.act_bits) || 16;
        const kvBits = Number(args?.kv_bits) || 16;
        const fp16Gb = params * 2.0;
        const quantGb = params * (wBits / 8.0);
        const savingsPct = ((1.0 - (quantGb / fp16Gb)) * 100.0).toFixed(1);
        const ratio = (fp16Gb / quantGb).toFixed(2);
        return [
            `# 📊 Compression Footprint Estimate: ${params}B Model`,
            '',
            `- **Original Size (FP16/BF16)**: ${fp16Gb.toFixed(2)} GB`,
            `- **Compressed Weights (${wBits}-bit)**: ${quantGb.toFixed(2)} GB`,
            `- **Weight Memory Savings**: **${savingsPct}%** reduction`,
            `- **Compression Ratio**: **${ratio}x**`,
            `- **Activation Precision**: ${actBits}-bit`,
            `- **KV Cache Precision**: ${kvBits}-bit`,
            '',
            `### Minimum Recommended GPU VRAM for Serving:`,
            `- **Weights**: ${quantGb.toFixed(1)} GB`,
            `- **Activation & KV Cache Overhead**: ~${(params * 0.15).toFixed(1)} GB`,
            `- **Total Minimum VRAM**: ~**${(quantGb + (params * 0.15)).toFixed(1)} GB**`
        ].join('\n');
    }
    if (action === 'recommend') {
        const mType = (args?.model_type || 'llama3').toLowerCase();
        const vram = Number(args?.available_vram_gb) || 24;
        const goal = args?.optimization_goal || 'balanced';
        if (mType.includes('vl') || mType.includes('vision')) {
            return [
                '# 🎯 Recommended Strategy: Vision-Language Model (VLM)',
                '',
                `- **Architecture**: Multimodal Vision-Language (${mType})`,
                `- **Available VRAM**: ${vram} GB`,
                `- **Optimization Goal**: ${goal}`,
                '',
                '### Recommended 2-Stage Pipeline:',
                '1. **Token Reduction**: Use **FastV** or **VisionZip**',
                '   - Prunes redundant image/patch tokens after layer 3.',
                '   - Reduces VLM prefill latency by **1.8x - 2.5x** with near-zero OCR/VQA loss.',
                '2. **Weight Quantization**: Use **AWQ (W4A16)**',
                '   - Protects salient vision-projection and cross-attention matrices.',
                '   - Fits 7B-14B VLMs comfortably in standard 16GB-24GB consumer GPUs.',
                '',
                '### Export Backend: `vllm`'
            ].join('\n');
        }
        if (mType.includes('deepseek') || mType.includes('moe')) {
            return [
                '# 🎯 Recommended Strategy: Massive Mixture-of-Experts (MoE)',
                '',
                `- **Architecture**: Sparse MoE (${mType})`,
                `- **Available VRAM**: ${vram} GB`,
                '',
                '### Recommended Pipeline:',
                '1. **Quantization**: **AWQ + RTN Hybrid (FP8 / INT4)**',
                '   - Quantize MoE feedforward expert weights with RTN/AWQ.',
                '   - Enables DeepSeek-V3 / R1 (671B) to run on a single 80GB GPU node.',
                '',
                '### Export Backend: `sglang`'
            ].join('\n');
        }
        if (mType.includes('wan') || mType.includes('video') || mType.includes('diffusion')) {
            return [
                '# 🎯 Recommended Strategy: Video Diffusion Model (Wan2.1 / Wan2.2)',
                '',
                `- **Architecture**: Video Diffusion Transformer (${mType})`,
                '',
                '### Recommended Pipeline:',
                '1. **Quantization**: **SmoothQuant / RTN INT8/FP8**',
                '   - Exports true quantized FP8 weights for video generation.',
                '2. **FastVID Token Reduction**: Reduces temporal inter-frame redundant tokens.',
                '',
                '### Export Backend: `lightx2v`'
            ].join('\n');
        }
        return [
            '# 🎯 Recommended Strategy: Dense Large Language Model',
            '',
            `- **Architecture**: Dense LLM (${mType})`,
            `- **Available VRAM**: ${vram} GB`,
            `- **Goal**: ${goal}`,
            '',
            '### Recommended Pipeline:',
            '1. **Weight Quantization**: **AWQ (W4A16, group_size: 128)**',
            '   - 75% memory reduction with <0.1 PPL degradation.',
            '2. **KV Cache Compression**: **KiviQuant (INT4 KV cache)**',
            '   - Enables 4x longer context windows in the same memory footprint.',
            '',
            '### Export Backend: `vllm`'
        ].join('\n');
    }
    if (action === 'generate_config') {
        const mType = args?.model_type || 'Llama';
        const mPath = args?.model_path || 'meta-llama/Meta-Llama-3-8B';
        const method = args?.method || 'Awq';
        const wBits = Number(args?.weight_bits) || 4;
        const backend = args?.backend || 'vllm';
        const yamlConfig = [
            'base:',
            '    seed: 42',
            'model:',
            `    type: ${mType}`,
            `    path: ${mPath}`,
            '    torch_dtype: auto',
            'calib:',
            '    name: pileval',
            '    download: True',
            '    n_samples: 128',
            '    seq_len: 512',
            'eval:',
            '    eval_pos: [pretrain, fake_quant]',
            '    name: wikitext2',
            '    download: True',
            '    seq_len: 2048',
            '    bs: 1',
            'quant:',
            `    method: ${method}`,
            '    weight:',
            `        bit: ${wBits}`,
            '        symmetric: True',
            '        granularity: per_group',
            '        group_size: 128',
            'save:',
            `    save_${backend}: True`,
            `    save_path: ./compressed_models/${mType}_${method}_${wBits}bit`
        ].join('\n');
        return [
            '# 📝 Generated AgentCompress Configuration',
            '',
            '```yaml',
            yamlConfig,
            '```',
            '',
            'Save this configuration to `config.yml` and execute:',
            '```bash',
            'agent-compress run --config config.yml',
            '```'
        ].join('\n');
    }
    return `UNKNOWN_ACTION: Action "${action}" is not supported. Use "list_algos", "list_models", "estimate", "recommend", or "generate_config".`;
}
//# sourceMappingURL=modelCompressor.js.map