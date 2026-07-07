'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

interface PermissionRow { id: string; key: string; description: string | null; }
interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionRow[];
  userCount: number;
}

function groupByPrefix(permissions: PermissionRow[]): Record<string, PermissionRow[]> {
  const groups: Record<string, PermissionRow[]> = {};
  for (const p of permissions) {
    const prefix = p.key.split('.')[0];
    (groups[prefix] ??= []).push(p);
  }
  return groups;
}

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<RoleDetail>(`/roles/${id}`),
      api.get<PermissionRow[]>('/permissions'),
    ])
      .then(([r, perms]) => {
        setRole(r);
        setName(r.name);
        setDescription(r.description ?? '');
        setSelected(new Set(r.permissions.map((p) => p.id)));
        setAllPermissions(perms);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function toggle(permId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/roles/${id}`, { name, description: description || null });
      await api.put(`/roles/${id}/permissions`, { permissionIds: Array.from(selected) });
      setSuccess('Role saved');
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save role');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/roles/${id}`);
      router.push('/settings/roles');
    } catch (err: unknown) {
      setDeleteError((err as ApiError).message ?? 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <Card className="m-6 border-danger/30 bg-danger/5">
        <CardContent className="pt-4 text-sm text-danger">{error ?? 'Role not found'}</CardContent>
      </Card>
    );
  }

  const groups = groupByPrefix(allPermissions);

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <PageHeader
        breadcrumb={[{ label: 'Settings', href: '/settings' }, { label: 'Roles', href: '/settings/roles' }]}
        title={role.name}
        description={`${role.userCount} user${role.userCount === 1 ? '' : 's'} assigned`}
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
        }
      />

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}
      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Permissions</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([prefix, perms]) => (
            <div key={prefix} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{prefix}</h3>
              <div className="space-y-1.5">
                {perms.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-border accent-[color:var(--primary)]"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="text-foreground">{p.key}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader><CardTitle className="text-danger">Danger zone</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Deleting a role is blocked while it&apos;s still assigned to a user or used as a workflow approver.
          </p>
          {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
          <Button
            variant="outline"
            className={cn('border-danger text-danger hover:bg-danger/10')}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Delete role
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
