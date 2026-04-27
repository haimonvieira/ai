import { useState } from 'react'
import { MessageSquare, Upload, Bot, Settings, Key, Send } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'rag' | 'agents' | 'settings'>('chat')
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('openai')
  const [messages, setMessages] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          api_key: apiKey,
          model: provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-2.1',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: false
        })
      })

      const data = await response.json()
      
      if (data.content) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
      }
    } catch (error) {
      console.error('Erro:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar mensagem' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">🚀 LLM Gateway BR</h1>
              <p className="text-sm text-gray-500">Plataforma Gratuita com BYOK</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                🔑 BYOK - Bring Your Own Key
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-2">
            <nav className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              <button
                onClick={() => setActiveTab('chat')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'chat' 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageSquare size={20} />
                <span className="font-medium">Chat</span>
              </button>
              
              <button
                onClick={() => setActiveTab('rag')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'rag' 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Upload size={20} />
                <span className="font-medium">RAG</span>
              </button>
              
              <button
                onClick={() => setActiveTab('agents')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'agents' 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Bot size={20} />
                <span className="font-medium">Agentes</span>
              </button>
              
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'settings' 
                    ? 'bg-primary-50 text-primary-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings size={20} />
                <span className="font-medium">Configurações</span>
              </button>
            </nav>

            {/* API Key Config */}
            <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key size={18} className="text-gray-500" />
                <h3 className="font-medium text-gray-700">API Key</h3>
              </div>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
              <input
                type="password"
                placeholder={`Chave ${provider}...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Sua chave não é armazenada no servidor
              </p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-10">
            {activeTab === 'chat' && (
              <div className="bg-white rounded-xl shadow-sm h-[calc(100vh-180px)] flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-20">
                      <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Comece uma conversa!</p>
                      <p className="text-sm">Configure sua API key e envie uma mensagem</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 px-4 py-3 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={loading || !apiKey}
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !apiKey || !input.trim()}
                      className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <Send size={20} />
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rag' && (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📚 RAG - Retrieval Augmented Generation</h2>
                <p className="text-gray-600 mb-6">
                  Faça upload de documentos e converse com eles usando busca semântica.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-primary-400 transition-colors cursor-pointer">
                  <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 font-medium">Arraste arquivos ou clique para upload</p>
                  <p className="text-sm text-gray-500 mt-2">PDF, TXT, DOCX, MD (máx. 50MB)</p>
                </div>
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">🤖 Agentes Autônomos</h2>
                <p className="text-gray-600 mb-6">
                  Crie agentes com objetivos específicos e ferramentas customizáveis.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer">
                    <Bot size={32} className="text-primary-500 mb-3" />
                    <h3 className="font-semibold text-gray-800">Novo Agente</h3>
                    <p className="text-sm text-gray-500 mt-2">Crie um agente do zero</p>
                  </div>
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer">
                    <Settings size={32} className="text-green-500 mb-3" />
                    <h3 className="font-semibold text-gray-800">Ferramentas</h3>
                    <p className="text-sm text-gray-500 mt-2">Calculadora, Web Search, etc.</p>
                  </div>
                  <div className="border rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer">
                    <MessageSquare size={32} className="text-purple-500 mb-3" />
                    <h3 className="font-semibold text-gray-800">Memórias</h3>
                    <p className="text-sm text-gray-500 mt-2">Gerencie memórias de conversas</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">⚙️ Configurações</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Provedores Suportados</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border rounded-lg p-4">
                        <div className="font-medium">OpenAI</div>
                        <div className="text-sm text-gray-500">GPT-4, GPT-3.5</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="font-medium">Anthropic</div>
                        <div className="text-sm text-gray-500">Claude 3</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="font-medium">Google</div>
                        <div className="text-sm text-gray-500">Gemini Pro</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">💡 Como funciona o BYOK?</h4>
                    <p className="text-sm text-blue-700">
                      Bring Your Own Key (BYOK) significa que você usa suas próprias chaves de API. 
                      Isso torna a plataforma 100% gratuita - você paga apenas pelo que usar nos provedores,
                      sem custos adicionais ou limitações da plataforma.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App
