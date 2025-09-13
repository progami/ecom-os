'use client'

export default function DocumentFilters() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label className="form-label text-muted-foreground">Category</label>
        <select className="form-input">
          <option value="">All Categories</option>
          <option value="contract">Contracts</option>
          <option value="identification">Identification</option>
          <option value="certification">Certifications</option>
          <option value="policy">Policies</option>
          <option value="report">Reports</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">Owner Type</label>
        <select className="form-input">
          <option value="">All Types</option>
          <option value="employee">Employee Documents</option>
          <option value="company">Company Documents</option>
          <option value="public">Public Documents</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">Upload Date</label>
        <select className="form-input">
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">File Size</label>
        <select className="form-input">
          <option value="">Any Size</option>
          <option value="small">&lt; 1 MB</option>
          <option value="medium">1 - 10 MB</option>
          <option value="large">10 - 50 MB</option>
          <option value="xlarge">&gt; 50 MB</option>
        </select>
      </div>
    </div>
  )
}
