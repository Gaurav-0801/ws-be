import { type WebSocket, WebSocketServer } from "ws"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "./config"
import { prismaClient } from "./database"
import type { WebSocketMessage } from "./types"

const wss = new WebSocketServer({ port: 8080 })

interface User {
  ws: WebSocket
  rooms: string[]
  userId: string
  name: string
}

const users: User[] = []

function checkUser(token: string): { userId: string; name: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    if (typeof decoded === "string") {
      return null
    }

    if (!decoded || !decoded.userId) {
      return null
    }

    return { userId: decoded.userId, name: decoded.name || "Anonymous" }
  } catch (e) {
    return null
  }
}

wss.on("connection", function connection(ws, request) {
  const url = request.url
  if (!url) {
    return
  }
  const queryParams = new URLSearchParams(url.split("?")[1])
  const token = queryParams.get("token") || ""
  const userInfo = checkUser(token)

  if (userInfo == null) {
    ws.close()
    return null
  }

  const user: User = {
    userId: userInfo.userId,
    name: userInfo.name,
    rooms: [],
    ws,
  }

  users.push(user)

  console.log(`User ${user.name} connected`)

  ws.on("message", async function message(data) {
    let parsedData: WebSocketMessage
    if (typeof data !== "string") {
      parsedData = JSON.parse(data.toString())
    } else {
      parsedData = JSON.parse(data)
    }

    console.log("Received message:", parsedData.type)

    if (parsedData.type === "join_room") {
      const currentUser = users.find((x) => x.ws === ws)
      if (currentUser && !currentUser.rooms.includes(parsedData.roomId)) {
        currentUser.rooms.push(parsedData.roomId)
        console.log(`User ${currentUser.name} joined room ${parsedData.roomId}`)

        // Send existing elements to the user
        try {
          const elements = await prismaClient.element.findMany({
            where: {
              roomId: Number(parsedData.roomId),
            },
            orderBy: {
              timestamp: "asc",
            },
          })

          ws.send(
            JSON.stringify({
              type: "room_state",
              elements: elements.map((el) => ({
                id: el.id,
                type: el.type,
                x: el.x,
                y: el.y,
                width: el.width,
                height: el.height,
                points: el.points,
                strokeColor: el.strokeColor,
                strokeWidth: el.strokeWidth,
                fillColor: el.fillColor,
                strokeStyle: el.strokeStyle,
                text: el.text,
                userId: el.userId,
                timestamp: Number(el.timestamp),
              })),
            }),
          )
        } catch (error) {
          console.error("Error fetching room elements:", error)
        }
      }
    }

    if (parsedData.type === "leave_room") {
      const currentUser = users.find((x) => x.ws === ws)
      if (!currentUser) {
        return
      }
      currentUser.rooms = currentUser.rooms.filter((x) => x !== parsedData.roomId)
      console.log(`User ${currentUser.name} left room ${parsedData.roomId}`)
    }

    if (parsedData.type === "drawing_update" && parsedData.element) {
      const roomId = parsedData.roomId
      const element = parsedData.element

      try {
        // Save element to database
        await prismaClient.element.upsert({
          where: { id: element.id },
          update: {
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            points: element.points,
            strokeColor: element.strokeColor,
            strokeWidth: element.strokeWidth,
            fillColor: element.fillColor,
            strokeStyle: element.strokeStyle,
            text: element.text,
            timestamp: BigInt(element.timestamp),
          },
          create: {
            id: element.id,
            roomId: Number(roomId),
            userId: element.userId,
            type: element.type,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            points: element.points,
            strokeColor: element.strokeColor,
            strokeWidth: element.strokeWidth,
            fillColor: element.fillColor,
            strokeStyle: element.strokeStyle,
            text: element.text,
            timestamp: BigInt(element.timestamp),
          },
        })

        // Broadcast to all users in the room
        users.forEach((user) => {
          if (user.rooms.includes(roomId) && user.ws !== ws) {
            user.ws.send(
              JSON.stringify({
                type: "drawing_update",
                element,
                roomId,
              }),
            )
          }
        })
      } catch (error) {
        console.error("Error saving element:", error)
      }
    }

    if (parsedData.type === "drawing_delete" && parsedData.elementId) {
      const roomId = parsedData.roomId
      const elementId = parsedData.elementId

      try {
        // Delete element from database
        await prismaClient.element.delete({
          where: { id: elementId },
        })

        // Broadcast to all users in the room
        users.forEach((user) => {
          if (user.rooms.includes(roomId)) {
            user.ws.send(
              JSON.stringify({
                type: "drawing_delete",
                elementId,
                roomId,
              }),
            )
          }
        })
      } catch (error) {
        console.error("Error deleting element:", error)
      }
    }

    if (parsedData.type === "cursor_move" && parsedData.cursor) {
      const roomId = parsedData.roomId

      // Broadcast cursor position to all users in the room
      users.forEach((user) => {
        if (user.rooms.includes(roomId) && user.ws !== ws) {
          user.ws.send(
            JSON.stringify({
              type: "cursor_move",
              cursor: parsedData.cursor,
              roomId,
            }),
          )
        }
      })
    }

    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId
      const message = parsedData.message

      if (!message) return

      try {
        await prismaClient.chat.create({
          data: {
            roomId: Number(roomId),
            message,
            userId: user.userId,
          },
        })

        users.forEach((user) => {
          if (user.rooms.includes(roomId)) {
            user.ws.send(
              JSON.stringify({
                type: "chat",
                message: message,
                roomId,
                userId: user.userId,
                userName: user.name,
              }),
            )
          }
        })
      } catch (error) {
        console.error("Error saving chat message:", error)
      }
    }
  })

  ws.on("close", () => {
    const index = users.findIndex((u) => u.ws === ws)
    if (index !== -1) {
      console.log(`User ${users[index].name} disconnected`)
      users.splice(index, 1)
    }
  })
})

console.log("WebSocket server running on port 8080")
