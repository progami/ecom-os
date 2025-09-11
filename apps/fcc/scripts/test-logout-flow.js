const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkCurrentAuthState() {
  console.log('\n=== Testing Logout Functionality ===\n')
  
  try {
    // Check if there are any users in the database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        tenantId: true,
        tenantName: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    console.log(`Found ${users.length} users in database`)
    if (users.length > 0) {
      console.log('\nCurrent users:')
      users.forEach(user => {
        console.log(`- ${user.email} (${user.tenantName})`)
      })
    }
    
    // Check for active sessions - Note: No session table in current schema
    console.log('\nNote: No session table in current schema - sessions are managed via cookies')
    
    // Check for Xero tokens stored in User model
    const usersWithTokens = await prisma.user.findMany({
      where: {
        xeroAccessToken: {
          not: null
        }
      },
      select: {
        email: true,
        tenantName: true,
        tokenExpiresAt: true,
        xeroAccessToken: true
      }
    })
    
    console.log(`\nFound ${usersWithTokens.length} users with Xero tokens`)
    if (usersWithTokens.length > 0) {
      console.log('\nUsers with Xero tokens:')
      usersWithTokens.forEach(user => {
        const isExpired = user.tokenExpiresAt ? new Date(user.tokenExpiresAt) < new Date() : true
        console.log(`- User: ${user.email}, Expires: ${user.tokenExpiresAt || 'N/A'}, ${isExpired ? '(EXPIRED)' : '(ACTIVE)'}`)
      })
    }
    
    console.log('\n=== Logout Flow Analysis ===\n')
    
    console.log('1. LOGOUT BUTTON LOCATIONS:')
    console.log('   - Sidebar Navigation (/components/ui/sidebar-navigation.tsx):')
    console.log('     * Located at bottom of sidebar')
    console.log('     * Shows user info with "Sign Out" button')
    console.log('     * Calls signOut() from AuthContext')
    console.log('')
    console.log('   - Unified Page Header (/components/ui/unified-page-header.tsx):')
    console.log('     * Red logout button with LogOut icon')
    console.log('     * Only visible when showAuthStatus=true and hasActiveToken=true')
    console.log('     * Calls disconnectFromXero() - WRONG! This only disconnects Xero, not user logout')
    console.log('')
    console.log('   - Xero Connection Status (/components/xero/xero-connection-status.tsx):')
    console.log('     * Dropdown menu with "Disconnect" option')
    console.log('     * Only disconnects from Xero, not full logout')
    
    console.log('\n2. LOGOUT FLOW:')
    console.log('   a) User clicks "Sign Out" in sidebar')
    console.log('   b) Calls signOut() in AuthContext')
    console.log('   c) Makes POST request to /api/v1/auth/signout')
    console.log('   d) Signout route clears cookies: user_session, xero_token, xero_state, xero_pkce')
    console.log('   e) AuthContext clears state and redirects to /login')
    
    console.log('\n3. IDENTIFIED ISSUES:')
    console.log('   ❌ UnifiedPageHeader logout button calls disconnectFromXero() instead of signOut()')
    console.log('   ❌ This only disconnects Xero, not logging out the user')
    console.log('   ❌ Confusing UX - logout button should log out user, not just disconnect Xero')
    
    console.log('\n4. RECOMMENDATIONS:')
    console.log('   ✅ Fix UnifiedPageHeader to call signOut() instead of disconnectFromXero()')
    console.log('   ✅ Consider renaming the button or adding separate buttons for clarity')
    console.log('   ✅ Ensure consistent logout behavior across all UI components')
    
  } catch (error) {
    console.error('Error checking auth state:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCurrentAuthState()