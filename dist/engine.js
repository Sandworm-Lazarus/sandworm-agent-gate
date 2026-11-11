(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgentGate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 262144;
  const MAX_CALLS = 200;
  const MAX_COST = 1000000000000;
  const encoder = new TextEncoder();
  const reasons = Object.freeze({
    ALLOW: 'Policy allows this read simulation.',
    REVIEW_WRITE: 'Write calls always require external approval.',
    REVIEW_POLICY: 'Policy requires external approval.',
    DENY_TOOL: 'Tool is not allowlisted.',
    DENY_EXPLICIT: 'An explicit deny rule matched.',
    DENY_ACTION: 'Action is not permitted for this tool.',
    DENY_RESOURCE: 'Resource is outside the allowlist.',
    DENY_PATH: 'Resource path is not canonical.',
    DENY_BUDGET: 'Estimated cost exceeds the per-call budget.',
    DENY_CALL: 'Call has an invalid structure.',
    DENY_DUPLICATE: 'Call identifier is duplicated in this batch.'
  });
  class GateError extends Error { constructor(code) { super(code === 'INPUT_LIMIT' ? 'Input exceeds the allowed limit.' : code === 'POLICY_INVALID' ? 'Policy does not match the supported schema.' : code === 'CRYPTO_UNAVAILABLE' ? 'SHA-256 is unavailable in this environment.' : 'Input is not supported JSON.'); this.name = 'GateError'; this.code = code; } }
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const keys = (obj, allowed, required) => object(obj) && Object.keys(obj).every(k => allowed.includes(k)) && required.every(k => own(obj, k));
  const token = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value);
  const cost = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_COST;
  function canonicalPath(value) {
    if (typeof value !== 'string' || value.length > 256 || !value.startsWith('/')) return false;
    if (value === '/') return true;
    if (!/^\/[a-zA-Z0-9._/-]+$/.test(value) || value.endsWith('/')) return false;
    return value.slice(1).split('/').every(segment => segment && segment !== '.' && segment !== '..');
  }
  function resourceRule(rule) { return keys(rule, ['type', 'value'], ['type', 'value']) && ['exact', 'prefix'].includes(rule.type) && canonicalPath(rule.value); }
  function matches(rule, resource) { return rule.type === 'exact' ? resource === rule.value : rule.value === '/' || resource === rule.value || resource.startsWith(rule.value + '/'); }
  function validatePolicy(policy) {
    if (!keys(policy, ['version', 'maxCostMicrousd', 'tools', 'denyTools', 'denyResources'], ['version', 'maxCostMicrousd', 'tools', 'denyTools', 'denyResources']) || policy.version !== 1 || !cost(policy.maxCostMicrousd) || !Array.isArray(policy.tools) || policy.tools.length < 1 || policy.tools.length > 30 || !Array.isArray(policy.denyTools) || policy.denyTools.length > 30 || !policy.denyTools.every(token) || !Array.isArray(policy.denyResources) || policy.denyResources.length > 50 || !policy.denyResources.every(resourceRule)) throw new GateError('POLICY_INVALID');
    const seen = new Set();
    for (const tool of policy.tools) {
      if (!keys(tool, ['name', 'actions', 'resources', 'maxCostMicrousd', 'requireApproval'], ['name', 'actions', 'resources', 'maxCostMicrousd', 'requireApproval']) || !token(tool.name) || seen.has(tool.name) || !Array.isArray(tool.actions) || tool.actions.length < 1 || tool.actions.length > 2 || new Set(tool.actions).size !== tool.actions.length || !tool.actions.every(a => a === 'read' || a === 'write') || !Array.isArray(tool.resources) || tool.resources.length < 1 || tool.resources.length > 50 || !tool.resources.every(resourceRule) || !cost(tool.maxCostMicrousd) || typeof tool.requireApproval !== 'boolean') throw new GateError('POLICY_INVALID');
      seen.add(tool.name);
    }
    return policy;
  }
  // Reject duplicate keys before JSON.parse can discard earlier policy values.
  function parse(text) {
    if (typeof text !== 'string') throw new GateError('JSON_INVALID');
    if (encoder.encode(text).length > MAX_BYTES) throw new GateError('INPUT_LIMIT');
    let i = 0;
    function ws() { while (i < text.length && /[\x20\t\r\n]/.test(text[i])) i++; }
    function string() {
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i++] === '"') { try { return JSON.parse(text.slice(start, i)); } catch (_) { throw new GateError('JSON_INVALID'); } }
      }
      throw new GateError('JSON_INVALID');
    }
    function value(depth) {
      if (depth > 32) throw new GateError('INPUT_LIMIT');
      ws();
      if (text[i] === '"') { string(); return; }
      if (text[i] === '{' || text[i] === '[') {
        const obj = text[i++] === '{'; const end = obj ? '}' : ']'; const seen = new Set(); ws();
        if (text[i] === end) { i++; return; }
        while (i < text.length) {
          if (obj) { ws(); if (text[i] !== '"') throw new GateError('JSON_INVALID'); const k = string(); if (seen.has(k) || ['__proto__', 'constructor', 'prototype'].includes(k)) throw new GateError('JSON_INVALID'); seen.add(k); ws(); if (text[i++] !== ':') throw new GateError('JSON_INVALID'); }
          value(depth + 1); ws(); if (text[i] === end) { i++; return; } if (text[i++] !== ',') throw new GateError('JSON_INVALID');
        }
        throw new GateError('JSON_INVALID');
      }
      const match = text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (!match || (/^-?\d/.test(match[0]) && !Number.isFinite(Number(match[0])))) throw new GateError('JSON_INVALID'); i += match[0].length;
    }
    value(0); ws(); if (i !== text.length) throw new GateError('JSON_INVALID');
    try { return JSON.parse(text); } catch (_) { throw new GateError('JSON_INVALID'); }
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  }
  async function sha256(text) {
    if (typeof text !== 'string') throw new GateError('JSON_INVALID');
    if (typeof globalThis.crypto === 'object' && globalThis.crypto.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
      return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    }
    if (typeof module === 'object' && module.exports) return require('node:crypto').createHash('sha256').update(text, 'utf8').digest('hex');
    throw new GateError('CRYPTO_UNAVAILABLE');
  }
  function decide(policy, call, duplicate) {
    let index = -1;
    const result = code => ({decision: code === 'ALLOW' ? 'allow' : code.startsWith('REVIEW_') ? 'review' : 'deny', reason: code, toolSlot: index < 0 ? null : index + 1});
    if (!keys(call, ['id', 'tool', 'action', 'resource', 'costMicrousd', 'args'], ['id', 'tool', 'action', 'resource', 'costMicrousd']) || !token(call.id) || !token(call.tool) || !['read', 'write'].includes(call.action) || !cost(call.costMicrousd) || (own(call, 'args') && !object(call.args))) return result('DENY_CALL');
    if (duplicate) return result('DENY_DUPLICATE');
    if (!canonicalPath(call.resource)) return result('DENY_PATH');
    index = policy.tools.findIndex(t => t.name === call.tool);
    if (policy.denyTools.includes(call.tool) || policy.denyResources.some(r => matches(r, call.resource))) return result('DENY_EXPLICIT');
    if (index < 0) return result('DENY_TOOL');
    const tool = policy.tools[index];
    if (!tool.actions.includes(call.action)) return result('DENY_ACTION');
    if (!tool.resources.some(r => matches(r, call.resource))) return result('DENY_RESOURCE');
    if (call.costMicrousd > Math.min(tool.maxCostMicrousd, policy.maxCostMicrousd)) return result('DENY_BUDGET');
    if (call.action === 'write') return result('REVIEW_WRITE');
    if (tool.requireApproval) return result('REVIEW_POLICY');
    return result('ALLOW');
  }
  async function audit(policyText, callsText) {
    const policy = validatePolicy(parse(policyText));
    const calls = parse(callsText);
    if (!Array.isArray(calls) || calls.length < 1 || calls.length > MAX_CALLS) throw new GateError('INPUT_LIMIT');
    const ids = new Map();
    for (const call of calls) if (object(call) && token(call.id)) ids.set(call.id, (ids.get(call.id) || 0) + 1);
    const rows = [];
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]; const verdict = decide(policy, call, object(call) && ids.get(call.id) > 1);
      rows.push({sequence: i + 1, ...verdict, callSha256: await sha256(canonical(call)), resourceSha256: object(call) && typeof call.resource === 'string' ? await sha256(call.resource) : null});
    }
    const counts = {total: rows.length, allow: 0, review: 0, deny: 0};
    for (const row of rows) counts[row.decision]++;
    return {schemaVersion: 1, engineVersion: '0.1.0', mode: 'simulation-only', policySha256: await sha256(policyText), inputSha256: await sha256(callsText), counts, rows};
  }
  const samplePolicy = {version: 1, maxCostMicrousd: 50000, tools: [{name: 'docs.read', actions: ['read'], resources: [{type: 'prefix', value: '/workspace/docs'}], maxCostMicrousd: 10000, requireApproval: false}, {name: 'docs.write', actions: ['write'], resources: [{type: 'prefix', value: '/workspace/docs'}], maxCostMicrousd: 20000, requireApproval: true}], denyTools: ['shell.exec'], denyResources: [{type: 'prefix', value: '/workspace/docs/private'}]};
  const sampleCalls = [
    {id:'read-1', tool:'docs.read', action:'read', resource:'/workspace/docs/guide.md', costMicrousd:500, args:{query:'synthetic example'}},
    {id:'write-1', tool:'docs.write', action:'write', resource:'/workspace/docs/draft.md', costMicrousd:1000},
    {id:'unknown-1', tool:'web.fetch', action:'read', resource:'/workspace/docs/guide.md', costMicrousd:500},
    {id:'traversal-1', tool:'docs.read', action:'read', resource:'/workspace/docs/../private/key.txt', costMicrousd:500},
    {id:'budget-1', tool:'docs.read', action:'read', resource:'/workspace/docs/guide.md', costMicrousd:15000},
    {id:'deny-1', tool:'docs.read', action:'read', resource:'/workspace/docs/private/secret.txt', costMicrousd:500}
  ];
  return Object.freeze({audit, parse, validatePolicy, canonicalPath, sha256, reasons, samplePolicy, sampleCalls, limits:Object.freeze({maxBytes:MAX_BYTES, maxCalls:MAX_CALLS, maxCostMicrousd:MAX_COST})});
});
