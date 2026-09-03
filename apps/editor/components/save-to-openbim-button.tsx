'use client'

/**
 * "💾 Save to openbim" button
 *
 * 跟 pascal 自家 SaveButton 平行存在,只在 URL 带 ?openbimProjectId&openbimFileId 时渲染。
 *
 * 流程:
 * 1. 调 pascal `useEditor.getState().modelExport('glb')` 拿当前 scene 完整 GLB Blob
 *    (走 pascal 现有 export pipeline,跟 thumbnail / download 走同一路径)
 * 2. PUT 给 openbim service:
 *    PUT http://127.0.0.1:21728/projects/<pid>/files/<fid>/glb
 *    body = blob, content-type = application/octet-stream
 * 3. openbim service 校验 magic + 写回 abs_path + 返回 {ok, sizeBytes}
 * 4. openbim main.cjs fs.watch 那个 GLB 文件 → renderer GLBViewer 自动 reload
 *
 * URL 参数:
 *  - openbimProjectId: openbim 项目 id (string)
 *  - openbimFileId:    openbim 文件 id (string) — 1:1 对应 pascal scene
 */

import { useEditor } from '@pascal-app/editor'
import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

type Status = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveToOpenBimButtonProps {
  projectId: string
  fileId: string
}

export function SaveToOpenBimButton({ projectId, fileId }: SaveToOpenBimButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // Reset status after a moment so the toast/checkmark doesn't stay forever
  useEffect(() => {
    if (status !== 'saved' && status !== 'error') return
    const timer = setTimeout(() => {
      setStatus('idle')
      setMessage(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [status])

  const handleSave = useCallback(async () => {
    if (status === 'saving') return
    setStatus('saving')
    setMessage(null)

    try {
      // 1) Export GLB via pascal's existing pipeline
      const modelExport = useEditor.getState().modelExport
      if (!modelExport) {
        throw new Error('pascal editor not ready (modelExport not registered)')
      }
      const artifact = await modelExport('glb', { onlyVisible: false })
      if (!artifact) {
        throw new Error('GLB export returned null (no scene renderer?)')
      }

      // 2) PUT to openbim service
      // openbim service 监听 loopback 127.0.0.1:21728 (dev/prod 同端点,
      // ACAO=*,无需 auth,service 自己校验 GLB magic 防滥用)
      const response = await fetch(
        `http://127.0.0.1:21728/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/glb`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: artifact.blob,
        },
      )

      if (!response.ok) {
        const errBody = await response.text().catch(() => '')
        throw new Error(
          `openbim service ${response.status}: ${errBody.slice(0, 200) || response.statusText}`,
        )
      }

      const result = (await response.json().catch(() => ({}))) as { sizeBytes?: number }
      setStatus('saved')
      setMessage(
        result.sizeBytes
          ? `Saved (${(result.sizeBytes / 1024).toFixed(1)} KB)`
          : 'Saved to openbim',
      )
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }, [projectId, fileId, status])

  const icon =
    status === 'saving' ? (
      <Loader2 className="size-4 animate-spin" />
    ) : status === 'saved' ? (
      <CheckCircle2 className="size-4" />
    ) : status === 'error' ? (
      <XCircle className="size-4" />
    ) : (
      <Save className="size-4" />
    )

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={status === 'saving'}
      className={
        'pointer-events-auto inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ' +
        (status === 'error'
          ? 'border-red-500/60 bg-red-500/10 text-red-300 hover:bg-red-500/20'
          : status === 'saved'
            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : 'border-blue-500/60 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20')
      }
      title={message ?? 'Export current pascal scene as GLB and overwrite the openbim file'}
    >
      {icon}
      <span>{status === 'error' ? 'Save failed' : 'Save to openbim'}</span>
      {message && status !== 'idle' && status !== 'saving' && (
        <span className="ml-1 text-xs opacity-75">· {message}</span>
      )}
    </button>
  )
}