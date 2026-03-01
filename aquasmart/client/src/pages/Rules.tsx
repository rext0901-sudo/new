import { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule as apiDeleteRule,
  reorderRules,
  type Rule,
  type RuleCondition,
  type RuleConditions,
  type RuleAction,
} from '../utils/api';
import { ruleToPlainEnglish, formatDateTime } from '../utils/format';

const VARIABLES = [
  { value: 'price_eur_kwh', label: 'Price (€/kWh)' },
  { value: 'outdoor_temp_c', label: 'Outdoor temp (°C)' },
  { value: 'hour_of_day', label: 'Hour of day' },
  { value: 'price_percentile_today', label: 'Price percentile (%)' },
];

const COMPARATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: 'between', label: 'between' },
];

const ACTIONS = [
  { value: 'set_temperature', label: 'Set temperature' },
  { value: 'set_mode', label: 'Set mode' },
  { value: 'boost', label: 'Boost' },
  { value: 'off', label: 'Turn off' },
];

interface RuleFormData {
  name: string;
  operator: 'AND' | 'OR';
  conditions: RuleCondition[];
  actionType: string;
  actionValue: string;
}

const emptyForm: RuleFormData = {
  name: '',
  operator: 'AND',
  conditions: [{ variable: 'price_eur_kwh', comparator: '<', value: 0.10 }],
  actionType: 'set_temperature',
  actionValue: '20',
};

export default function Rules() {
  const { data, refetch } = useApi(() => getRules(), []);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>({ ...emptyForm });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const rules = data?.rules ?? [];

  const handleToggle = async (rule: Rule) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await apiDeleteRule(id);
    refetch();
  };

  const handleDuplicate = (rule: Rule) => {
    setForm({
      name: `${rule.name} (copy)`,
      operator: rule.conditions.operator,
      conditions: [...rule.conditions.rules],
      actionType: rule.action.type,
      actionValue: String(rule.action.value ?? ''),
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (rule: Rule) => {
    setForm({
      name: rule.name,
      operator: rule.conditions.operator,
      conditions: [...rule.conditions.rules],
      actionType: rule.action.type,
      actionValue: String(rule.action.value ?? ''),
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const conditions: RuleConditions = {
      operator: form.operator,
      rules: form.conditions,
    };
    const action: RuleAction = {
      type: form.actionType,
      value: form.actionType === 'off' ? undefined
        : form.actionType === 'set_mode' ? form.actionValue
        : parseFloat(form.actionValue),
    };

    if (editingId) {
      await updateRule(editingId, { name: form.name, conditions, action });
    } else {
      await createRule({ name: form.name, conditions, action, enabled: true, priority: 0 });
    }
    setShowForm(false);
    setForm({ ...emptyForm });
    setEditingId(null);
    refetch();
  };

  const updateCondition = (idx: number, field: string, value: unknown) => {
    const updated = [...form.conditions];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setForm({ ...form, conditions: updated as RuleCondition[] });
  };

  const addCondition = () => {
    setForm({
      ...form,
      conditions: [...form.conditions, { variable: 'price_eur_kwh', comparator: '<', value: 0.10 }],
    });
  };

  const removeCondition = (idx: number) => {
    setForm({ ...form, conditions: form.conditions.filter((_, i) => i !== idx) });
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDrop = async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const reordered = [...rules];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    await reorderRules(reordered.map((r) => r.id));
    setDragIdx(null);
    refetch();
  };

  const previewText = form.name
    ? ruleToPlainEnglish(
        { operator: form.operator, rules: form.conditions },
        {
          type: form.actionType,
          value: form.actionType === 'off' ? undefined
            : form.actionType === 'set_mode' ? form.actionValue
            : parseFloat(form.actionValue),
        }
      )
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Automation Rules</h2>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); }}
          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
        >
          Add Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="w-8 px-2"></th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Enabled</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Priority</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Last Triggered</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, idx) => (
              <tr
                key={rule.id}
                className="border-b hover:bg-slate-50"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
              >
                <td className="px-2 text-slate-400 cursor-grab">&#x2630;</td>
                <td className="px-4 py-3 font-medium text-slate-800">{rule.name}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      rule.enabled ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      rule.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{rule.priority}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {rule.last_triggered ? formatDateTime(rule.last_triggered) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {ruleToPlainEnglish(rule.conditions, rule.action)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => handleEdit(rule)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                    <button onClick={() => handleDuplicate(rule)} className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">Copy</button>
                    <button onClick={() => handleDelete(rule.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No rules configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rule Builder Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              {editingId ? 'Edit Rule' : 'New Rule'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Rule Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g., Cheap hours boost"
                />
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium text-slate-600">Conditions</label>
                  <select
                    value={form.operator}
                    onChange={(e) => setForm({ ...form, operator: e.target.value as 'AND' | 'OR' })}
                    className="border border-slate-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>

                {form.conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2 flex-wrap">
                    <select
                      value={cond.variable}
                      onChange={(e) => updateCondition(idx, 'variable', e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[120px]"
                    >
                      {VARIABLES.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                    <select
                      value={cond.comparator}
                      onChange={(e) => updateCondition(idx, 'comparator', e.target.value)}
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm w-20"
                    >
                      {COMPARATORS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    {cond.comparator === 'between' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={Array.isArray(cond.value) ? cond.value[0] : ''}
                          onChange={(e) => {
                            const arr = Array.isArray(cond.value) ? [...cond.value] : [0, 0];
                            arr[0] = parseFloat(e.target.value);
                            updateCondition(idx, 'value', arr);
                          }}
                          className="border border-slate-300 rounded px-2 py-1.5 text-sm w-16"
                        />
                        <span className="text-xs text-slate-400">–</span>
                        <input
                          type="number"
                          step="any"
                          value={Array.isArray(cond.value) ? cond.value[1] : ''}
                          onChange={(e) => {
                            const arr = Array.isArray(cond.value) ? [...cond.value] : [0, 0];
                            arr[1] = parseFloat(e.target.value);
                            updateCondition(idx, 'value', arr);
                          }}
                          className="border border-slate-300 rounded px-2 py-1.5 text-sm w-16"
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={typeof cond.value === 'number' ? cond.value : ''}
                        onChange={(e) => updateCondition(idx, 'value', parseFloat(e.target.value))}
                        className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24"
                      />
                    )}
                    {form.conditions.length > 1 && (
                      <button onClick={() => removeCondition(idx)} className="text-red-500 hover:text-red-700 text-lg px-1">&times;</button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addCondition}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  + Add condition
                </button>
              </div>

              {/* Action */}
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">Action</label>
                <div className="flex items-center gap-2">
                  <select
                    value={form.actionType}
                    onChange={(e) => setForm({ ...form, actionType: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                  {form.actionType !== 'off' && (
                    <input
                      type={form.actionType === 'set_mode' ? 'text' : 'number'}
                      value={form.actionValue}
                      onChange={(e) => setForm({ ...form, actionValue: e.target.value })}
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24"
                      placeholder={form.actionType === 'set_mode' ? 'eco' : '20'}
                    />
                  )}
                </div>
              </div>

              {/* Preview */}
              {previewText && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  {previewText}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
