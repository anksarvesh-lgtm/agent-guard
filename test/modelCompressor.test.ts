import { describe, it, expect } from 'vitest';
import { handleModelCompressor } from '../src/tools/modelCompressor.js';

describe('Model Compressor Tool (AgentCompress)', () => {
  it('lists all supported compression algorithms across 3 categories', () => {
    const result = handleModelCompressor({ action: 'list_algos' });
    expect(result).toContain('AgentCompress: Supported Algorithms');
    expect(result).toContain('AWQ');
    expect(result).toContain('GPTQ');
    expect(result).toContain('SmoothQuant');
    expect(result).toContain('QuaRot');
    expect(result).toContain('FastV');
    expect(result).toContain('ToMe');
    expect(result).toContain('VisionZip');
    expect(result).toContain('Wanda');
    expect(result).toContain('ShortGPT');
  });

  it('lists supported model families and deployment backends', () => {
    const result = handleModelCompressor({ action: 'list_models' });
    expect(result).toContain('DeepSeekV3');
    expect(result).toContain('Qwen2VL');
    expect(result).toContain('Wan2_2_T2V');
    expect(result).toContain('vLLM');
    expect(result).toContain('SGLang');
    expect(result).toContain('LightX2V');
  });

  it('accurately estimates memory footprint and compression ratios', () => {
    const result = handleModelCompressor({
      action: 'estimate',
      param_billions: 70,
      weight_bits: 4,
    });
    expect(result).toContain('**Original Size (FP16/BF16)**: 140.00 GB');
    expect(result).toContain('**Compressed Weights (4-bit)**: 35.00 GB');
    expect(result).toContain('**75.0%** reduction');
    expect(result).toContain('**4.00x**');
  });

  it('accurately estimates massive MoE models (DeepSeek-R1 671B)', () => {
    const result = handleModelCompressor({
      action: 'estimate',
      param_billions: 671,
      weight_bits: 4,
    });
    expect(result).toContain('1342.00 GB');
    expect(result).toContain('335.50 GB');
    expect(result).toContain('**75.0%** reduction');
  });

  it('recommends multimodal 2-stage pipeline for VLMs', () => {
    const result = handleModelCompressor({
      action: 'recommend',
      model_type: 'qwen2_5_vl',
      available_vram_gb: 24,
    });
    expect(result).toContain('Vision-Language Model (VLM)');
    expect(result).toContain('FastV');
    expect(result).toContain('AWQ');
    expect(result).toContain('vllm');
  });

  it('recommends MoE strategy for DeepSeek architectures', () => {
    const result = handleModelCompressor({
      action: 'recommend',
      model_type: 'deepseek_v3',
      available_vram_gb: 80,
    });
    expect(result).toContain('Massive Mixture-of-Experts (MoE)');
    expect(result).toContain('AWQ + RTN');
    expect(result).toContain('sglang');
  });

  it('recommends video generation pipeline for Wan2.1 diffusion models', () => {
    const result = handleModelCompressor({
      action: 'recommend',
      model_type: 'wan2.1_t2v',
    });
    expect(result).toContain('Video Diffusion Model');
    expect(result).toContain('SmoothQuant / RTN INT8/FP8');
    expect(result).toContain('lightx2v');
  });

  it('generates reproducible YAML configuration for compression runs', () => {
    const result = handleModelCompressor({
      action: 'generate_config',
      model_type: 'Llama',
      model_path: 'meta-llama/Meta-Llama-3-8B',
      method: 'Awq',
      weight_bits: 4,
      backend: 'vllm',
    });
    expect(result).toContain('type: Llama');
    expect(result).toContain('method: Awq');
    expect(result).toContain('bit: 4');
    expect(result).toContain('save_vllm: True');
  });
});
