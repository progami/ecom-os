'use client'

interface Props {
  value: {
    department?: string
    status?: string
    employmentType?: string
    joined?: string
  }
  onChange: (next: Props['value']) => void
}

export default function EmployeeFilters({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label className="form-label text-muted-foreground">Department</label>
        <select value={value.department || ''} onChange={(e) => onChange({ ...value, department: e.target.value || undefined })} className="form-input">
          <option value="">All Departments</option>
          <option value="engineering">Engineering</option>
          <option value="marketing">Marketing</option>
          <option value="sales">Sales</option>
          <option value="hr">Human Resources</option>
          <option value="finance">Finance</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">Status</label>
        <select value={value.status || ''} onChange={(e) => onChange({ ...value, status: e.target.value || undefined })} className="form-input">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On Leave</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">Employment Type</label>
        <select value={value.employmentType || ''} onChange={(e) => onChange({ ...value, employmentType: e.target.value || undefined })} className="form-input">
          <option value="">All Types</option>
          <option value="FULL_TIME">Full Time</option>
          <option value="PART_TIME">Part Time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Intern</option>
        </select>
      </div>
      
      <div>
        <label className="form-label text-muted-foreground">Join Date</label>
        <select value={value.joined || ''} onChange={(e) => onChange({ ...value, joined: e.target.value || undefined })} className="form-input">
          <option value="">All Time</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="last_6_months">Last 6 Months</option>
          <option value="last_year">Last Year</option>
        </select>
      </div>
    </div>
  )
}
