// Mock authentication for development without database
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Mock users for development
const mockUsers = [
  {
    id: '1',
    email: 'jarraramjad@ecomos.com',
    password: 'SecurePass123!',
    name: 'Jarrar Amjad',
    role: 'admin',
    permissions: ['admin', 'staff']
  },
  {
    id: '2',
    email: 'admin@ecomos.com',
    password: 'AdminPass123!',
    name: 'Admin User',
    role: 'admin',
    permissions: ['admin', 'staff']
  },
  {
    id: '3',
    email: 'staff@ecomos.com',
    password: 'StaffPass123!',
    name: 'Staff User',
    role: 'staff',
    permissions: ['staff']
  }
];

export const authOptionsMock: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Find user in mock database
        const user = mockUsers.find(u => 
          u.email === credentials.email && 
          u.password === credentials.password
        )

        if (!user) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
        token.permissions = user.permissions
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.role = token.role as string
        session.user.permissions = token.permissions as string[]
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-key'
}