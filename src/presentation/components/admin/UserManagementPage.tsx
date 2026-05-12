'use client'

// 관리자 전용 사용자 계정 관리 페이지
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useUsers, useCreateUser, useDeleteUser, useUpdateUserRole } from '@/application/usecase/user/useUsers'
import { useAuthContext } from '@/presentation/components/auth/AuthProvider'
import { UserRole } from '@/domain/model/User'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: '관리자',
  recruiter: '채용담당자',
}

export default function UserManagementPage() {
  const { user: me } = useAuthContext()
  const { data: users = [], isLoading } = useUsers()
  const createUser = useCreateUser()
  const deleteUser = useDeleteUser()
  const updateRole = useUpdateUserRole()

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'recruiter' as UserRole })
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createUser.mutateAsync(form)
      toast.success(`${form.name} 계정을 생성하고 비밀번호 설정 이메일을 발송했습니다.`)
      setAddOpen(false)
      setForm({ email: '', name: '', role: 'recruiter' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계정 생성에 실패했습니다.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      toast.success(`${deleteTarget.name} 계정을 삭제했습니다.`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계정 삭제에 실패했습니다.')
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    try {
      await updateRole.mutateAsync({ userId, role })
      toast.success('역할을 변경했습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '역할 변경에 실패했습니다.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">계정 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">채용 담당자 및 관리자 계정을 관리합니다.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-1.5">
          <UserPlus size={15} />
          계정 추가
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">등록된 계정이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">이메일</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">역할</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">등록일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className={i < users.length - 1 ? 'border-b border-border' : ''}
                >
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {u.id === me?.uid && (
                      <span className="ml-2 text-xs text-muted-foreground">(나)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onValueChange={(val) => handleRoleChange(u.id, val as UserRole)}
                      disabled={u.id === me?.uid}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recruiter">채용담당자</SelectItem>
                        <SelectItem value="admin">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(u.createdAt, 'yyyy.MM.dd', { locale: ko })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                      disabled={u.id === me?.uid}
                      onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 계정 추가 다이얼로그 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>계정 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">이름</Label>
              <Input
                id="add-name"
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">이메일</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@hunet.co.kr"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>역할</Label>
              <Select
                value={form.role}
                onValueChange={(val) => setForm((p) => ({ ...p, role: val as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">채용담당자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              계정 생성 후 입력한 이메일로 비밀번호 설정 링크가 자동 발송됩니다.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? '생성 중...' : '계정 추가'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>계정 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground pt-2">
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> 계정을 삭제하면
            복구할 수 없습니다. 계속하시겠습니까?
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
