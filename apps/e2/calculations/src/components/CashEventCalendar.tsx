'use client';

import React, { useState } from 'react';
import { CashEvent } from '@/types/financial';

interface CashEventCalendarProps {
  events: CashEvent[];
}

export default function CashEventCalendar({ events }: CashEventCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterType, setFilterType] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filter events
  const filteredEvents = events.filter(event => {
    const eventMonth = event.date.slice(0, 7);
    const matchesMonth = eventMonth === selectedMonth;
    const matchesType = filterType === 'all' || event.type === filterType;
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
    return matchesMonth && matchesType && matchesCategory;
  });

  // Calculate monthly summary
  const monthlyInflows = filteredEvents
    .filter(e => e.type === 'inflow')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const monthlyOutflows = filteredEvents
    .filter(e => e.type === 'outflow')
    .reduce((sum, e) => sum + e.amount, 0);

  // Get unique categories
  const categories = Array.from(new Set(events.map(e => e.category).filter(Boolean))) as string[];

  // Generate calendar days
  const generateCalendarDays = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const days = generateCalendarDays();

  // Get events for a specific day
  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter(event => event.date.startsWith(dateStr));
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cash Event Calendar</h3>
            <p className="text-sm text-gray-600 mt-1">
              Track scheduled payments and receipts
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() + i);
                const value = date.toISOString().slice(0, 7);
                const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                return (
                  <option key={value} value={value}>{label}</option>
                );
              })}
            </select>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Types</option>
              <option value="inflow">Inflows</option>
              <option value="outflow">Outflows</option>
            </select>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800">Monthly Inflows</p>
            <p className="text-2xl font-bold text-green-900">
              ${monthlyInflows.toLocaleString()}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800">Monthly Outflows</p>
            <p className="text-2xl font-bold text-red-900">
              ${monthlyOutflows.toLocaleString()}
            </p>
          </div>
          <div className={`${monthlyInflows - monthlyOutflows >= 0 ? 'bg-blue-50' : 'bg-yellow-50'} rounded-lg p-4`}>
            <p className="text-sm font-medium ${monthlyInflows - monthlyOutflows >= 0 ? 'text-blue-800' : 'text-yellow-800'}">
              Net Cash Flow
            </p>
            <p className={`text-2xl font-bold ${monthlyInflows - monthlyOutflows >= 0 ? 'text-blue-900' : 'text-yellow-900'}`}>
              ${(monthlyInflows - monthlyOutflows).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7 gap-0">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-700 border-b">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const hasEvents = dayEvents.length > 0;
            
            return (
              <div
                key={index}
                className={`
                  min-h-[100px] p-2 border-b border-r
                  ${!day ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}
                  ${hasEvents ? 'cursor-pointer' : ''}
                `}
              >
                {day && (
                  <>
                    <div className="font-medium text-sm text-gray-900 mb-1">{day}</div>
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <div
                        key={event.id || `${event.date}-${i}`}
                        className={`
                          text-xs p-1 mb-1 rounded truncate
                          ${event.type === 'inflow' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                          }
                        `}
                        title={`${event.description}: $${event.amount.toLocaleString()}`}
                      >
                        ${(event.amount / 1000).toFixed(0)}k - {event.description.slice(0, 15)}...
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedMonth} Events ({filteredEvents.length})
          </h4>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No events scheduled for this period
              </p>
            ) : (
              filteredEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`
                        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${event.type === 'inflow' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                        }
                      `}>
                        {event.type === 'inflow' ? '↓' : '↑'} {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {event.category?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Uncategorized'}
                      </span>
                      {event.status === 'completed' && (
                        <span className="text-xs text-green-600">✓ Completed</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.date).toLocaleDateString()}
                      {event.relatedPO && ` • PO: ${event.relatedPO}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${
                      event.type === 'inflow' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${event.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}