'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/page-header';

interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  permissions: { id: string; key: string }[];
  userCount: number;
}

export default function RolesAdminPage() {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<RoleSummary[]>('/roles')
      .then(setRoles)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(role: RoleSummary) {
    if (!confirm(`Delete the "${role.name}" role?`)) return;
    setDeletingId(role.id);
    setError(null);
    try {
      await api.delete(`/roles/${role.id}`);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to delete role');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/roles', { name, description: description || undefined });
      setOpen(false);
      setName('');
      setDescription('');
      load();
    } catch (err: unknown) {
      setCreateError((err as ApiError).message ?? 'Failed to create role');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Settings', href: '/settings' }]}
        title="Roles"
        description="Create roles and choose which permissions each one grants"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />New role</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Name</Label>
                  <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Procurement Officer" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-description">Description (optional)</Label>
                  <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                {createError && <p className="text-sm text-danger">{createError}</p>}
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                  {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Create role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No roles yet</p>
            <p className="text-sm text-muted-foreground">Create a role to start assigning it to employees.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Permissions</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Users</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/settings/roles/${role.id}`} className="font-medium text-foreground hover:text-primary">
                        {role.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{role.description || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className="text-xs">{role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}</Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{role.userCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild aria-label={`Edit ${role.name}`}>
                          <Link href={`/settings/roles/${role.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10 hover:text-danger"
                          disabled={deletingId === role.id}
                          onClick={() => handleDelete(role)}
                          aria-label={`Delete ${role.name}`}
                        >
                          {deletingId === role.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
