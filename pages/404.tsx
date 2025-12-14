import Layout from "../components/Layout"
import Link from "next/link"

export default function Error404() {
  return (
    <Layout
      meta={{
        title: "Not Found",
        description: "The requested site could not be found ...",
      }}
      error={404}
    >
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent mb-4">
          404
        </h1>
        <p className="text-xl text-dark-400 mb-6">
          There is nothing to be found here :/
        </p>
        <Link 
          href="/" 
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-glow"
        >
          Go Back Home
        </Link>
      </div>
    </Layout>
  )
}
