'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, List, ListOrdered, Link2, Smile,
  Strikethrough, Undo, Redo, Minus, ImageIcon, Video,
  X, Check, LinkIcon,
} from 'lucide-react'

// ============================================================
// RICH TEXT EDITOR — TipTap
// Extensions: StarterKit, Link, Image, Placeholder
// ============================================================

const COMMON_EMOJIS = ['😊', '👋', '🚀', '✅', '💡', '🎯', '📊', '⏱️', '💬', '🔗', '📦', '🏷️']

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
}

interface ToolButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolButton({ onClick, active, disabled, title, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded text-xs transition-colors ${
        active
          ? 'bg-brand-100 text-brand-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

// ─── Mini modal inline ────────────────────────────────────────
function InlineModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="absolute left-0 top-full mt-1 z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-3"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe el mensaje...',
  minHeight = 200,
  className = '',
}: RichTextEditorProps) {
  const lastEmittedRef = useRef<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal states
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [imageWidth, setImageWidth] = useState('200')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoLabel, setVideoLabel] = useState('▶ Ver vídeo')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-brand-600 underline', style: 'color:#4f46e5;text-decoration:underline;' },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { style: 'max-width:100%;display:inline-block;' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmittedRef.current = html
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: `min-height: ${minHeight}px; padding: 12px 14px;`,
      },
    },
  })

  // Sync external value changes (AI-generated content)
  useEffect(() => {
    if (!editor) return
    if (value === lastEmittedRef.current) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // ─── Link helpers ─────────────────────────────────────────
  const openLinkModal = useCallback(() => {
    if (!editor) return
    const existingLink = editor.getAttributes('link').href ?? ''
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ''
    )
    setLinkUrl(existingLink)
    setLinkText(selectedText)
    setShowLinkModal(true)
    setShowImageModal(false)
    setShowVideoModal(false)
  }, [editor])

  const applyLink = useCallback(() => {
    if (!editor || !linkUrl) return
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
    if (editor.state.selection.empty && linkText) {
      editor.chain().focus()
        .insertContent(`<a href="${url}">${linkText}</a>`)
        .run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setShowLinkModal(false)
    setLinkUrl('')
    setLinkText('')
  }, [editor, linkUrl, linkText])

  const removeLink = useCallback(() => {
    editor?.chain().focus().unsetLink().run()
    setShowLinkModal(false)
  }, [editor])

  // ─── Image helpers ────────────────────────────────────────
  const openImageModal = useCallback(() => {
    setImageUrl('')
    setImageAlt('')
    setImageWidth('200')
    setShowImageModal(true)
    setShowLinkModal(false)
    setShowVideoModal(false)
  }, [])

  const applyImageUrl = useCallback(() => {
    if (!editor || !imageUrl) return
    const widthAttr = imageWidth ? ` width="${imageWidth}"` : ''
    const altAttr = imageAlt ? ` alt="${imageAlt}"` : ''
    const src = imageUrl.startsWith('http') ? imageUrl : `https://${imageUrl}`
    // Insert as raw HTML to preserve width attribute
    editor.chain().focus().insertContent(
      `<img src="${src}"${altAttr} style="width:${imageWidth || 200}px;max-width:100%;display:inline-block;" />`
    ).run()
    setShowImageModal(false)
  }, [editor, imageUrl, imageAlt, imageWidth])

  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      const w = imageWidth || '200'
      editor.chain().focus().insertContent(
        `<img src="${base64}" style="width:${w}px;max-width:100%;display:inline-block;" />`
      ).run()
      setShowImageModal(false)
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [editor, imageWidth])

  // ─── Video helpers ────────────────────────────────────────
  const openVideoModal = useCallback(() => {
    setVideoUrl('')
    setVideoLabel('▶ Ver vídeo')
    setShowVideoModal(true)
    setShowLinkModal(false)
    setShowImageModal(false)
  }, [])

  function getVideoThumbnail(url: string): string | null {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
    // Vimeo (thumbnail requires API; skip for now)
    return null
  }

  const applyVideo = useCallback(() => {
    if (!editor || !videoUrl) return
    const href = videoUrl.startsWith('http') ? videoUrl : `https://${videoUrl}`
    const thumbnail = getVideoThumbnail(videoUrl)
    let html: string

    if (thumbnail) {
      // YouTube: thumbnail image that links to the video
      html = `<a href="${href}" style="display:inline-block;position:relative;text-decoration:none;">` +
        `<img src="${thumbnail}" alt="${videoLabel}" style="width:320px;max-width:100%;display:block;border-radius:8px;" />` +
        `<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);` +
        `background:rgba(0,0,0,0.7);color:#fff;border-radius:50%;width:56px;height:56px;` +
        `display:flex;align-items:center;justify-content:center;font-size:22px;">▶</span>` +
        `</a>`
    } else {
      // Generic video link (email-safe, no iframe)
      html = `<a href="${href}" style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;` +
        `border-radius:8px;padding:12px 20px;text-decoration:none;color:#4f46e5;font-weight:500;">` +
        `▶ ${videoLabel}</a>`
    }

    editor.chain().focus().insertContent(html).run()
    setShowVideoModal(false)
  }, [editor, videoUrl, videoLabel])

  // ─── Emoji ────────────────────────────────────────────────
  const insertEmoji = useCallback((emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run()
  }, [editor])

  if (!editor) return null

  const isLinkActive = editor.isActive('link')

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${className}`}>
      {/* Toolbar */}
      <div className="relative flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">

        {/* Historial */}
        <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer">
          <Undo className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer">
          <Redo className="w-3.5 h-3.5" />
        </ToolButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Formato */}
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita">
          <Bold className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva">
          <Italic className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Listas */}
        <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
          <List className="w-3.5 h-3.5" />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Enlace */}
        <div className="relative">
          <ToolButton onClick={openLinkModal} active={isLinkActive} title={isLinkActive ? 'Editar/quitar enlace' : 'Insertar enlace'}>
            <Link2 className="w-3.5 h-3.5" />
          </ToolButton>
          {showLinkModal && (
            <InlineModal title="Insertar enlace" onClose={() => setShowLinkModal(false)}>
              {!editor.state.selection.empty || linkText ? null : (
                <div className="mb-2">
                  <label className="block text-xs text-gray-500 mb-1">Texto del enlace</label>
                  <input
                    autoFocus
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="Texto visible"
                    value={linkText}
                    onChange={e => setLinkText(e.target.value)}
                  />
                </div>
              )}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">URL</label>
                <input
                  autoFocus={editor.state.selection.empty && !linkText}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  placeholder="https://ejemplo.com"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyLink() }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); applyLink() }}
                  disabled={!linkUrl}
                  className="flex items-center gap-1 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40"
                >
                  <Check className="w-3 h-3" /> Aplicar
                </button>
                {isLinkActive && (
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); removeLink() }}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5"
                  >
                    Quitar enlace
                  </button>
                )}
              </div>
            </InlineModal>
          )}
        </div>

        {/* Imagen */}
        <div className="relative">
          <ToolButton onClick={openImageModal} title="Insertar imagen / logo">
            <ImageIcon className="w-3.5 h-3.5" />
          </ToolButton>
          {showImageModal && (
            <InlineModal title="Insertar imagen" onClose={() => setShowImageModal(false)}>
              {/* Subir archivo */}
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Subir archivo (logo, imagen)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Elegir archivo
                  </button>
                  <span className="text-xs text-gray-400">PNG, JPG, SVG</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Para emails, usa una URL pública (los adjuntos base64 pueden bloquearse).
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="w-full h-px bg-gray-100" />
                <span className="text-xs text-gray-400 whitespace-nowrap">o por URL</span>
                <span className="w-full h-px bg-gray-100" />
              </div>

              <div className="mb-2">
                <label className="block text-xs text-gray-500 mb-1">URL de la imagen</label>
                <input
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  placeholder="https://tudominio.com/logo.png"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ancho (px)</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="200"
                    value={imageWidth}
                    onChange={e => setImageWidth(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Texto alternativo</label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="Logo de empresa"
                    value={imageAlt}
                    onChange={e => setImageAlt(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); applyImageUrl() }}
                disabled={!imageUrl}
                className="flex items-center gap-1 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> Insertar imagen
              </button>
            </InlineModal>
          )}
        </div>

        {/* Vídeo */}
        <div className="relative">
          <ToolButton onClick={openVideoModal} title="Insertar vídeo (YouTube/Vimeo)">
            <Video className="w-3.5 h-3.5" />
          </ToolButton>
          {showVideoModal && (
            <InlineModal title="Insertar vídeo" onClose={() => setShowVideoModal(false)}>
              <p className="text-xs text-gray-500 mb-3">
                Los emails no soportan reproductores. Se insertará una miniatura con enlace al vídeo.
              </p>
              <div className="mb-2">
                <label className="block text-xs text-gray-500 mb-1">URL del vídeo (YouTube, Vimeo…)</label>
                <input
                  autoFocus
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  placeholder="https://youtu.be/..."
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Texto del botón</label>
                <input
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  placeholder="▶ Ver vídeo"
                  value={videoLabel}
                  onChange={e => setVideoLabel(e.target.value)}
                />
              </div>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); applyVideo() }}
                disabled={!videoUrl}
                className="flex items-center gap-1 text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> Insertar vídeo
              </button>
            </InlineModal>
          )}
        </div>

        {/* Separador horizontal */}
        <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea separadora">
          <Minus className="w-3.5 h-3.5" />
        </ToolButton>

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Emojis */}
        <div className="relative group">
          <ToolButton onClick={() => {}} title="Emojis">
            <Smile className="w-3.5 h-3.5" />
          </ToolButton>
          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex flex-wrap gap-0.5 w-44 p-2 bg-white border border-gray-200 rounded-xl shadow-lg">
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertEmoji(emoji) }}
                className="text-base hover:bg-gray-100 rounded p-0.5 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Click outside handler — close modals */}
        {(showLinkModal || showImageModal || showVideoModal) && (
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => {
              setShowLinkModal(false)
              setShowImageModal(false)
              setShowVideoModal(false)
            }}
          />
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="text-sm text-gray-800 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />

      {/* Pie del editor */}
      <div className="px-3 py-1.5 border-t border-gray-50 bg-gray-50 flex justify-between text-xs text-gray-300">
        <span className="flex items-center gap-2">
          <LinkIcon className="w-3 h-3" /> Soporta imágenes, enlaces y vídeos
        </span>
        <span>{editor.getText().length} caracteres</span>
      </div>
    </div>
  )
}
