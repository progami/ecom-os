'use client'

import Link from 'next/link'
import { ArrowLeft, Plus, Key, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useState } from 'react'

export default function SecretsPage() {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})
  // This would come from your database
  const secrets: any[] = []

  const toggleSecretVisibility = (id: string) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const maskSecret = (value: string) => {
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4)
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Key className="h-8 w-8 text-purple-400" />
              Secrets Management
            </h1>
            <p className="text-muted-foreground">Manage API keys and credentials</p>
          </div>
        </div>
        <Button onClick={() => alert('Add Secret functionality coming soon!')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Secret
        </Button>
      </div>

      <div className="grid gap-4 mb-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Secrets</CardDescription>
            <CardTitle className="text-2xl">{secrets.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">
              {secrets.filter((s: any) => s.active).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expiring Soon</CardDescription>
            <CardTitle className="text-2xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Rotation</CardDescription>
            <CardTitle className="text-2xl">Never</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys & Credentials</CardTitle>
          <CardDescription>
            Securely manage integration credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Key Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Last Rotated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No secrets configured. Add your API keys to connect integrations.
                  </TableCell>
                </TableRow>
              ) : (
                secrets.map((secret: any) => (
                  <TableRow key={secret.id}>
                    <TableCell className="font-medium">{secret.service}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-md text-xs ${
                        secret.environment === 'PRODUCTION' 
                          ? 'bg-red-500/20 text-red-400' 
                          : secret.environment === 'STAGING'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {secret.environment}
                      </span>
                    </TableCell>
                    <TableCell>{secret.keyName}</TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {showValues[secret.id] 
                          ? secret.encryptedValue 
                          : maskSecret(secret.encryptedValue || '****************')}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleSecretVisibility(secret.id)}
                        >
                          {showValues[secret.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-md text-xs ${
                        secret.active 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {secret.active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {secret.expiresAt 
                        ? new Date(secret.expiresAt).toLocaleDateString() 
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {secret.lastUsedAt 
                        ? new Date(secret.lastUsedAt).toLocaleDateString() 
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {secret.lastRotatedAt 
                        ? new Date(secret.lastRotatedAt).toLocaleDateString() 
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        Rotate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}