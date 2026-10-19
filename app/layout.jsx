import './globals.css'
import Header from '@/components/Header'
export const metadata = { title: 'MyLib', description: 'Read and download novels, manga and research papers' }
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}" }} /></head>
      <body><Header /><main className="mx-auto max-w-5xl px-4 pb-16">{children}</main></body>
    </html>
  )
}
