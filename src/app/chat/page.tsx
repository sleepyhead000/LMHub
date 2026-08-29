'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useEffect } from 'react'
import { MODELS } from '@/lib/pricing/config'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Menu, Plus, MessageSquare, Trash2, StopCircle } from 'lucide-react'

export default function ChatPage() {
  const [model, setModel] = useState(MODELS[0].id)
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const fetchConversations = async () => {
    const res = await fetch('/api/conversations')
    if (res.ok) {
        const data = await res.json()
        setConversations(data)
    }
  }

  const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading, stop, error } = useChat({
    api: '/api/chat',
    body: { model, conversationId: activeConvId },
    onResponse: (response) => {
        const convId = response.headers.get('x-conversation-id')
        if (convId && !activeConvId) {
            setActiveConvId(convId)
            fetchConversations()
        }
    }
  })

  useEffect(() => {
    // We intentionally fetch once on mount
    const fetchInitial = async () => {
      const res = await fetch('/api/conversations')
      if (res.ok) {
          const data = await res.json()
          setConversations(data)
      }
    }
    fetchInitial()
  }, [])

  useEffect(() => {
    const fetchMessages = async () => {
        if (!activeConvId) {
            setMessages([])
            return
        }

        const res = await fetch(`/api/conversations/${activeConvId}`)
        if (res.ok) {
            const data = await res.json()
            setMessages(data.map((m: { id: string, role: string, content: string, model: string }) => ({ id: m.id, role: m.role as 'system' | 'user' | 'assistant' | 'data', content: m.content })))
            if (data.length > 0) {
                 setModel(data[data.length-1].model || MODELS[0].id)
            }
        }
    }
    fetchMessages()
  }, [activeConvId, setMessages])


  const createNewChat = () => {
      setActiveConvId(null)
      setMessages([])
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (res.ok) {
          if (activeConvId === id) {
              createNewChat()
          }
          fetchConversations()
      }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 flex flex-col overflow-hidden`}>
        <div className="p-4 flex items-center justify-between">
            <button onClick={createNewChat} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full justify-center">
                <Plus size={18} /> New Chat
            </button>
        </div>
        <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
                <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`flex items-center justify-between p-3 mx-2 rounded-md cursor-pointer group ${activeConvId === conv.id ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
                >
                    <div className="flex items-center gap-2 truncate">
                        <MessageSquare size={16} className="text-gray-500" />
                        <span className="truncate text-sm">{conv.title}</span>
                    </div>
                    <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 text-red-500">
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b dark:border-zinc-800 flex items-center px-4 justify-between bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded">
                    <Menu size={20} />
                </button>
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>
            <div>
               {/* Could add user profile / credits link here */}
               <a href="/dashboard" className="text-sm text-blue-600 hover:underline">Dashboard</a>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 mt-20">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-medium">How can I help you today?</h2>
                    </div>
                ) : (
                    messages.map(m => (
                        <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-xl p-4 ${
                                m.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-zinc-900 border dark:border-zinc-800 text-gray-800 dark:text-gray-200 shadow-sm'
                            }`}>
                                {m.role === 'user' ? (
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                   <div className="flex justify-start">
                       <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                           <div className="flex gap-1 items-center">
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                               <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                           </div>
                       </div>
                   </div>
                )}
            </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800">
            <div className="max-w-3xl mx-auto">
                {error && <div className="text-red-500 text-sm mb-2 px-2">{error.message}</div>}
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        disabled={isLoading}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                    <div className="absolute right-2 flex items-center">
                        {isLoading ? (
                             <button type="button" onClick={stop} className="p-2 text-gray-500 hover:text-red-500">
                                <StopCircle size={20} />
                            </button>
                        ) : (
                            <button type="submit" disabled={!input.trim()} className="p-2 text-blue-600 disabled:text-gray-400">
                                <Send size={20} />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  )
}
