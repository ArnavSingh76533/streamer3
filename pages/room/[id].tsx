import Room from "../../components/Room"
import { GetServerSideProps } from "next"
import Layout from "../../components/Layout"

export default function RoomPage({ 
  roomId, 
  initialName, 
  initialIsPublic 
}: { 
  roomId: string
  initialName?: string
  initialIsPublic?: boolean
}) {
  return (
    <Layout
      meta={{
        title: "Room " + roomId,
        description: "Watch in sync and join the watch party with your friends",
      }}
      roomId={roomId}
    >
      <Room id={roomId} initialName={initialName} initialIsPublic={initialIsPublic} />
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ params, query }) => {
  const roomId = params?.id

  // force min length of 4
  if (!roomId || typeof roomId !== "string" || roomId.length < 4) {
    return {
      notFound: true,
    }
  }

  // Extract name and isPublic from query params if present
  const initialName = typeof query.name === "string" ? query.name : undefined
  const initialIsPublic = query.isPublic === "true"

  return {
    props: {
      roomId,
      initialName,
      initialIsPublic,
    },
  }
}
