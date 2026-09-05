import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sekme bazlı hata sınırı (UX doc "Durum tasarımı" girişi, sözleşme §2.1). Render sırasında
 * fırlayan bir hatayı yakalar, "Bu ekran yüklenemedi. [Tekrar dene]" gösterir; sekme çubuğu ve
 * bağlantı rozeti (bu sınırın DIŞINDA, `App.tsx`'te) etkilenmez.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    // React zaten kendi konsol uyarısını basar (StrictMode'da development'ta çift); burada
    // yalnızca bir kez, ek bilgiyle loglarız — React'in kendi loglamasını maskelemeyiz.
    console.error('Ekran hatası yakalandı:', error)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-400"
        >
          <p>Bu ekran yüklenemedi.</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Tekrar dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
