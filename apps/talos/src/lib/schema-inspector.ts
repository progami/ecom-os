import { Prisma } from '@targon/prisma-talos'

// Utility to inspect and document all fields in a Prisma model
export function inspectModel(modelName: string): void {
 const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)
 
 if (!model) {
 // console.error(`Model ${modelName} not found`)
 return
 }
 
 // console.log(`\n=== Model: ${modelName} ===\n`)
 // console.log('Fields:')
 
 model.fields.forEach(field => {
 const attributes = []
 if (field.isRequired) attributes.push('required')
 if (field.isUnique) attributes.push('unique')
 if (field.isList) attributes.push('list')
 if (field.isId) attributes.push('id')
 
 const _attrStr = attributes.length > 0 ? ` [${attributes.join(', ')}]` : ''
 
 // console.log(` - ${field.name}: ${field.type}${attrStr}`)
 
 if (field.documentation) {
 // console.log(` Documentation: ${field.documentation}`)
 }
 })
 
 // console.log('\nRelations:')
 model.fields.filter(f => f.kind === 'object').forEach(_field => {
 // console.log(` - ${field.name} -> ${field.type}`)
 })
}

// Generate a report of all models and their fields
export function generateSchemaReport(): string {
 const report: string[] = []
 
 report.push('# Database Schema Report\n')
 report.push(`Generated: ${new Date().toISOString()}\n`)
 
 Prisma.dmmf.datamodel.models.forEach(model => {
 report.push(`\n## ${model.name}\n`)
 
 // Scalar fields
 const scalarFields = model.fields.filter(f => f.kind !== 'object')
 if (scalarFields.length > 0) {
 report.push('### Fields:')
 scalarFields.forEach(field => {
 const required = field.isRequired ? ' (required)' : ''
 report.push(`- **${field.name}**: ${field.type}${required}`)
 })
 }
 
 // Relations
 const relations = model.fields.filter(f => f.kind === 'object')
 if (relations.length > 0) {
 report.push('\n### Relations:')
 relations.forEach(field => {
 report.push(`- **${field.name}**: ${field.type}`)
 })
 }
 })
 
 return report.join('\n')
}

// Get all fields for a model (useful for dynamic configuration)
export function getModelFieldNames(modelName: string): string[] {
 const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)
 if (!model) return []
 
 return model.fields
 .filter(f => f.kind !== 'object') // Exclude relations
 .map(f => f.name)
}

// Check if a field exists in a model
export function fieldExists(modelName: string, fieldName: string): boolean {
 const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)
 if (!model) return false
 
 return model.fields.some(f => f.name === fieldName)
}