export const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Bookkeeping API',
    version: '1.0.0',
    description: 'Comprehensive API for bookkeeping application with Xero integration',
    contact: {
      name: 'API Support',
      email: 'support@bookkeeping.app'
    }
  },
  servers: [
    {
      url: 'https://localhost:3003/api/v1',
      description: 'Development server'
    },
    {
      url: 'https://api.bookkeeping.app/v1',
      description: 'Production server'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and session management' },
    { name: 'Xero', description: 'Xero integration and data synchronization' },
    { name: 'Analytics', description: 'Analytics and reporting endpoints' },
    { name: 'Bookkeeping', description: 'Core bookkeeping operations' },
    { name: 'CashFlow', description: 'Cash flow forecasting and budgeting' },
    { name: 'Database', description: 'Database management and inspection' },
    { name: 'Setup', description: 'Initial setup and configuration' },
    { name: 'System', description: 'System monitoring and health' },
    { name: 'User', description: 'User management' },
    { name: 'Queue', description: 'Background job management' },
    { name: 'Logs', description: 'Application logging' }
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'bookkeeping_session',
        description: 'Session-based authentication using secure HTTP-only cookies'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          xeroUserId: { type: 'string' },
          tenantName: { type: 'string' },
          hasCompletedSetup: { type: 'boolean' },
          lastLoginAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          xeroTransactionId: { type: 'string' },
          type: { type: 'string', enum: ['SPEND', 'RECEIVE'] },
          status: { type: 'string' },
          total: { type: 'number' },
          totalTax: { type: 'number' },
          date: { type: 'string', format: 'date' },
          reference: { type: 'string' },
          bankAccountId: { type: 'string' },
          contactId: { type: 'string' },
          isReconciled: { type: 'boolean' }
        }
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          xeroInvoiceId: { type: 'string' },
          type: { type: 'string', enum: ['ACCREC', 'ACCPAY'] },
          status: { type: 'string' },
          invoiceNumber: { type: 'string' },
          reference: { type: 'string' },
          total: { type: 'number' },
          amountDue: { type: 'number' },
          amountPaid: { type: 'number' },
          date: { type: 'string', format: 'date' },
          dueDate: { type: 'string', format: 'date' },
          contactId: { type: 'string' }
        }
      },
      Contact: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          xeroContactId: { type: 'string' },
          name: { type: 'string' },
          emailAddress: { type: 'string' },
          contactNumber: { type: 'string' },
          isSupplier: { type: 'boolean' },
          isCustomer: { type: 'boolean' }
        }
      },
      BankAccount: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          xeroAccountId: { type: 'string' },
          name: { type: 'string' },
          code: { type: 'string' },
          currencyCode: { type: 'string' },
          balance: { type: 'number' },
          balanceLastUpdated: { type: 'string', format: 'date-time' }
        }
      },
      GLAccount: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string' },
          description: { type: 'string' },
          systemAccount: { type: 'boolean' },
          enablePaymentsToAccount: { type: 'boolean' },
          showInExpenseClaims: { type: 'boolean' },
          class: { type: 'string' },
          reportingCode: { type: 'string' },
          reportingCodeName: { type: 'string' }
        }
      },
      SOP: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          year: { type: 'string' },
          chartOfAccount: { type: 'string' },
          pointOfInvoice: { type: 'string' },
          serviceType: { type: 'string' },
          referenceTemplate: { type: 'string' },
          referenceExample: { type: 'string' },
          descriptionTemplate: { type: 'string' },
          descriptionExample: { type: 'string' },
          note: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      },
      CashFlowForecast: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date' },
          openingBalance: { type: 'number' },
          totalInflows: { type: 'number' },
          totalOutflows: { type: 'number' },
          closingBalance: { type: 'number' },
          bestCase: { type: 'number' },
          worstCase: { type: 'number' },
          confidenceLevel: { type: 'number' }
        }
      },
      CashFlowBudget: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          accountCode: { type: 'string' },
          accountName: { type: 'string' },
          category: { type: 'string' },
          monthYear: { type: 'string' },
          budgetedAmount: { type: 'number' },
          actualAmount: { type: 'number' },
          variance: { type: 'number' }
        }
      },
      DatabaseTable: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          recordCount: { type: 'integer' },
          lastUpdated: { type: 'string', format: 'date-time' },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                isPrimary: { type: 'boolean' },
                isOptional: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    parameters: {
      TableNameParam: {
        name: 'tableName',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Name of the database table'
      },
      PageParam: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', default: 1 },
        description: 'Page number for pagination'
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 20 },
        description: 'Number of items per page'
      },
      DateFromParam: {
        name: 'from',
        in: 'query',
        schema: { type: 'string', format: 'date' },
        description: 'Start date for filtering'
      },
      DateToParam: {
        name: 'to',
        in: 'query',
        schema: { type: 'string', format: 'date' },
        description: 'End date for filtering'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFoundError: {
        description: 'The requested resource was not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    }
  },
  paths: {
    // Authentication endpoints
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        operationId: 'registerUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    userId: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/NotFoundError' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login user',
        operationId: 'loginUser',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/auth/signout': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign out user',
        operationId: 'signOutUser',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Signed out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/auth/session': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current session',
        operationId: 'getSession',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Session information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authenticated: { type: 'boolean' },
                    user: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    
    // User endpoints
    '/user/info': {
      get: {
        tags: ['User'],
        summary: 'Get user information',
        operationId: 'getUserInfo',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'User information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },

    // Xero endpoints
    '/xero/auth': {
      get: {
        tags: ['Xero'],
        summary: 'Initiate Xero OAuth flow',
        operationId: 'initiateXeroAuth',
        security: [{ sessionAuth: [] }],
        responses: {
          '302': {
            description: 'Redirect to Xero OAuth',
            headers: {
              Location: { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/xero/auth/callback': {
      get: {
        tags: ['Xero'],
        summary: 'Xero OAuth callback',
        operationId: 'xeroCallback',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '302': {
            description: 'Redirect to dashboard',
            headers: {
              Location: { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/xero/status': {
      get: {
        tags: ['Xero'],
        summary: 'Get Xero connection status',
        operationId: 'getXeroStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Xero connection status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: { type: 'boolean' },
                    tenantId: { type: 'string' },
                    tenantName: { type: 'string' },
                    tokenExpiresAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/disconnect': {
      post: {
        tags: ['Xero'],
        summary: 'Disconnect from Xero',
        operationId: 'disconnectXero',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Disconnected successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/transactions': {
      get: {
        tags: ['Xero'],
        summary: 'Get bank transactions',
        operationId: 'getTransactions',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/DateFromParam' },
          { $ref: '#/components/parameters/DateToParam' }
        ],
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transactions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Transaction' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/bills': {
      get: {
        tags: ['Xero'],
        summary: 'Get bills (accounts payable)',
        operationId: 'getBills',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' }
        ],
        responses: {
          '200': {
            description: 'List of bills',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    bills: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Invoice' }
                    },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/accounts': {
      get: {
        tags: ['Xero'],
        summary: 'Get all accounts',
        operationId: 'getAccounts',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accounts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/BankAccount' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/gl-accounts': {
      get: {
        tags: ['Xero'],
        summary: 'Get general ledger accounts',
        operationId: 'getGLAccounts',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of GL accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accounts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GLAccount' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/vendors': {
      get: {
        tags: ['Xero'],
        summary: 'Get vendor list',
        operationId: 'getVendors',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of vendors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendors: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Contact' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Analytics endpoints
    '/analytics/top-vendors': {
      get: {
        tags: ['Analytics'],
        summary: 'Get top vendors by spend',
        operationId: 'getTopVendors',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'List of top vendors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          contactId: { type: 'string' },
                          name: { type: 'string' },
                          totalSpend: { type: 'number' },
                          transactionCount: { type: 'integer' },
                          averageTransaction: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/analytics/spend-trend': {
      get: {
        tags: ['Analytics'],
        summary: 'Get spending trends',
        operationId: 'getSpendTrend',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['week', 'month', 'quarter', 'year'] } }
        ],
        responses: {
          '200': {
            description: 'Spending trend data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    trend: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          period: { type: 'string' },
                          amount: { type: 'number' },
                          count: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/analytics/category-breakdown': {
      get: {
        tags: ['Analytics'],
        summary: 'Get expense breakdown by category',
        operationId: 'getCategoryBreakdown',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Category breakdown',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    categories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          category: { type: 'string' },
                          amount: { type: 'number' },
                          percentage: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Bookkeeping endpoints
    '/bookkeeping/bank-accounts': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get bank accounts',
        operationId: 'getBankAccounts',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of bank accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accounts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/BankAccount' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/bookkeeping/bank-transactions': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get bank transactions',
        operationId: 'getBankTransactions',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'accountId', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of bank transactions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transactions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Transaction' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/bookkeeping/cash-balance': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get cash balance summary',
        operationId: 'getCashBalance',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Cash balance summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalBalance: { type: 'number' },
                    accounts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          accountId: { type: 'string' },
                          name: { type: 'string' },
                          balance: { type: 'number' },
                          currency: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/bookkeeping/financial-summary': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get financial summary',
        operationId: 'getFinancialSummary',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Financial summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    revenue: { type: 'number' },
                    expenses: { type: 'number' },
                    netIncome: { type: 'number' },
                    assets: { type: 'number' },
                    liabilities: { type: 'number' },
                    equity: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/bookkeeping/sops': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get standard operating procedures',
        operationId: 'getSOPs',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'string' } },
          { name: 'active', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': {
            description: 'List of SOPs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sops: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SOP' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Bookkeeping'],
        summary: 'Create new SOP',
        operationId: 'createSOP',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SOP' }
            }
          }
        },
        responses: {
          '201': {
            description: 'SOP created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SOP' }
              }
            }
          }
        }
      }
    },
    '/bookkeeping/sops/{id}': {
      get: {
        tags: ['Bookkeeping'],
        summary: 'Get specific SOP',
        operationId: 'getSOP',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'SOP details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SOP' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFoundError' }
        }
      },
      put: {
        tags: ['Bookkeeping'],
        summary: 'Update SOP',
        operationId: 'updateSOP',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SOP' }
            }
          }
        },
        responses: {
          '200': {
            description: 'SOP updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SOP' }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Bookkeeping'],
        summary: 'Delete SOP',
        operationId: 'deleteSOP',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '204': {
            description: 'SOP deleted'
          }
        }
      }
    },

    // Cash Flow endpoints
    '/cashflow/forecast': {
      get: {
        tags: ['CashFlow'],
        summary: 'Get cash flow forecast',
        operationId: 'getCashFlowForecast',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } }
        ],
        responses: {
          '200': {
            description: 'Cash flow forecast',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    forecast: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CashFlowForecast' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/cashflow/budget/import': {
      post: {
        tags: ['CashFlow'],
        summary: 'Import budget data',
        operationId: 'importBudget',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Budget imported',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    recordsImported: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/cashflow/budget/export': {
      get: {
        tags: ['CashFlow'],
        summary: 'Export budget data',
        operationId: 'exportBudget',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'excel'] } }
        ],
        responses: {
          '200': {
            description: 'Budget file',
            content: {
              'text/csv': {},
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {}
            }
          }
        }
      }
    },

    // Database endpoints
    '/database/info': {
      get: {
        tags: ['Database'],
        summary: 'Get database information',
        operationId: 'getDatabaseInfo',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Database information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tables: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DatabaseTable' }
                    },
                    totalRecords: { type: 'integer' },
                    databaseType: { type: 'string' },
                    lastActivity: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/database/table/{tableName}': {
      get: {
        tags: ['Database'],
        summary: 'Get table data',
        operationId: 'getTableData',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TableNameParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
        ],
        responses: {
          '200': {
            description: 'Table data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    records: { type: 'array', items: { type: 'object' } },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    hasMore: { type: 'boolean' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid table name',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },
    '/database/status': {
      get: {
        tags: ['Database'],
        summary: 'Get database status',
        operationId: 'getDatabaseStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Database status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: { type: 'boolean' },
                    type: { type: 'string' },
                    size: { type: 'integer' },
                    tables: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Setup endpoints
    '/setup/status': {
      get: {
        tags: ['Setup'],
        summary: 'Get setup status',
        operationId: 'getSetupStatus',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Setup status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    completed: { type: 'boolean' },
                    steps: {
                      type: 'object',
                      properties: {
                        userCreated: { type: 'boolean' },
                        xeroConnected: { type: 'boolean' },
                        dataImported: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/setup/configure': {
      post: {
        tags: ['Setup'],
        summary: 'Configure initial settings',
        operationId: 'configureSetup',
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  preferences: { type: 'object' },
                  importSettings: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Configuration saved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/setup/complete': {
      post: {
        tags: ['Setup'],
        summary: 'Mark setup as complete',
        operationId: 'completeSetup',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Setup completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },

    // System endpoints
    '/system/health': {
      get: {
        tags: ['System'],
        summary: 'Get system health',
        operationId: 'getSystemHealth',
        responses: {
          '200': {
            description: 'System health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    checks: {
                      type: 'object',
                      properties: {
                        database: { type: 'boolean' },
                        xero: { type: 'boolean' },
                        cache: { type: 'boolean' }
                      }
                    },
                    uptime: { type: 'integer' },
                    version: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Logs endpoints
    '/logs': {
      get: {
        tags: ['Logs'],
        summary: 'Get application logs',
        operationId: 'getLogs',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'level', in: 'query', schema: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { $ref: '#/components/parameters/DateFromParam' },
          { $ref: '#/components/parameters/DateToParam' }
        ],
        responses: {
          '200': {
            description: 'Application logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          timestamp: { type: 'string', format: 'date-time' },
                          level: { type: 'string' },
                          message: { type: 'string' },
                          context: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  'x-readme': {
    'explorer-enabled': true,
    'proxy-enabled': true,
    'samples-enabled': true
  }
};