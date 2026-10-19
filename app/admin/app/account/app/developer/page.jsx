export const metadata = { title: 'Developer info' }
const A = ({ href, children }) => <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
export default function Developer() {
  return (
    <div className="card mx-auto mt-10 max-w-md space-y-3">
      <h1 className="text-2xl font-bold">Developer info</h1>
      <p><b>Name:</b> Helix</p>
      <p><b>GitHub:</b> <A href="https://github.com/Prathamesh241024">github.com/Prathamesh241024</A></p>
      <p><b>Email:</b> <A href="mailto:prathameshvaishnav12@gmail.com">prathameshvaishnav12@gmail.com</A></p>
      <p><b>Email 2:</b> <A href="mailto:helixsaintlauren24@gmail.com">helixsaintlauren24@gmail.com</A></p>
      <p><b>WhatsApp:</b> <A href="https://wa.me/qr/G7AQHSBORO5BA1?s=r">Chat on WhatsApp</A></p>
    </div>
  )
}
