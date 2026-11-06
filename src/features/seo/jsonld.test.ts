import { describe, expect, it } from 'vitest'
import {
  breadcrumbSchema,
  jsonLdGraph,
  offerCatalogSchema,
  organizationSchema,
  personInputFromCms,
  personSchema,
  projectSchema,
  websiteSchema,
} from './jsonld'
import { SCHEMA_IDS } from './site'

describe('personSchema', () => {
  it('falls back to site identity and drops empty values', () => {
    const person = personSchema()
    expect(person).toMatchObject({
      '@type': 'Person',
      '@id': SCHEMA_IDS.person,
      name: 'Keltoum Malouki',
      jobTitle: 'Full Stack Web Developer',
      image: 'https://www.keltoummalouki.com/images/keltoum-malouki.jpg',
    })
    expect(person).not.toHaveProperty('worksFor')
    expect(person).not.toHaveProperty('knowsAbout')
    expect((person.sameAs as string[]).length).toBeGreaterThan(0)
  })
})

describe('personInputFromCms', () => {
  it('maps CMS content (current job, schools, skills, socials, email)', () => {
    const input = personInputFromCms({
      about: {
        fullName: 'Keltoum Malouki',
        avatarUrl: '',
        headline: 'Full Stack Developer',
        bio: 'Bio',
        cvUrl: '',
        availabilityStatus: 'available',
        location: 'Casablanca',
      },
      socialLinks: [
        { id: '1', platform: 'github', label: 'GitHub', url: 'https://github.com/x', icon: 'github' },
        { id: '2', platform: 'email', label: 'Email', url: 'mailto:me@example.com', icon: 'email' },
      ],
      experiences: [
        { id: 'a', company: 'Old Co', location: '', date: '', role: '', description: '', url: '', imageUrl: '', technologies: [], isCurrent: false },
        { id: 'b', company: 'DabaDoc', location: '', date: '', role: '', description: '', url: 'https://www.dabadoc.com', imageUrl: '', technologies: [], isCurrent: true },
      ],
      education: [{ id: 'e', institution: 'YouCode', location: '', date: '', degree: '', field: '', description: '', imageUrl: '' }],
      skillCategories: [{ id: 'c', name: 'FE', skills: [{ id: 's', name: 'React', icon: '', imageUrl: '', level: null }] }],
      certifications: [],
      languages: [{ id: 'l', name: 'Arabic', level: 'Native', icon: '' }],
    })
    expect(input.worksFor).toEqual({ name: 'DabaDoc', url: 'https://www.dabadoc.com' })
    expect(input.sameAs).toEqual(['https://github.com/x'])
    expect(input.email).toBe('me@example.com')
    expect(input.alumniOf).toEqual([{ name: 'YouCode' }])
    expect(input.knowsAbout).toEqual(['React'])
    expect(input.knowsLanguage).toEqual(['Arabic'])
  })

  it('never puts messaging links (phone numbers) into sameAs', () => {
    const input = personInputFromCms({
      socialLinks: [
        { id: '1', platform: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/212600000000', icon: 'whatsapp' },
        { id: '2', platform: 'telegram', label: 'Telegram', url: 'https://t.me/someone', icon: 'telegram' },
        { id: '3', platform: 'github', label: 'GitHub', url: ' https://github.com/x ', icon: 'github' },
      ],
      experiences: [], education: [], skillCategories: [], certifications: [], languages: [],
    })
    expect(input.sameAs).toEqual(['https://github.com/x'])
    expect(JSON.stringify(personSchema(input))).not.toContain('wa.me')
  })

  it('ignores a placeholder CMS headline for jobTitle', () => {
    const input = personInputFromCms(
      {
        about: { fullName: 'Keltoum Malouki', avatarUrl: '', headline: 'Get to know me', bio: '', cvUrl: '', availabilityStatus: 'available', location: '' },
        socialLinks: [], experiences: [], education: [], skillCategories: [], certifications: [], languages: [],
      },
      { jobTitle: 'Full Stack Web Developer' },
    )
    expect(input.jobTitle).toBe('Full Stack Web Developer')
  })

  it('uses fallbacks when the CMS is empty', () => {
    const input = personInputFromCms(
      { socialLinks: [], experiences: [], education: [], skillCategories: [], certifications: [], languages: [] },
      { jobTitle: 'Dev', description: 'From messages' },
    )
    expect(input.jobTitle).toBe('Dev')
    expect(input.description).toBe('From messages')
    expect(input.worksFor).toBeNull()
  })
})

describe('graph nodes', () => {
  it('links Organization and WebSite to the Person by @id', () => {
    const graph = jsonLdGraph(personSchema(), organizationSchema(), websiteSchema(), null)
    const nodes = graph['@graph'] as Record<string, unknown>[]
    expect(graph['@context']).toBe('https://schema.org')
    expect(nodes).toHaveLength(3)
    expect(nodes[1]).toMatchObject({ '@type': 'Organization', founder: { '@id': SCHEMA_IDS.person } })
    expect(nodes[2]).toMatchObject({ '@type': 'WebSite', publisher: { '@id': SCHEMA_IDS.person } })
  })

  it('builds absolute breadcrumb items in order', () => {
    const crumbs = breadcrumbSchema('/en/about', [
      { name: 'Home', path: '/en' },
      { name: 'About', path: '/en/about' },
    ])
    expect(crumbs['@id']).toBe('https://www.keltoummalouki.com/en/about#breadcrumb')
    expect((crumbs.itemListElement as { position: number; item: string }[])[1]).toMatchObject({
      position: 2,
      item: 'https://www.keltoummalouki.com/en/about',
    })
  })

  it('types a project with a repo as SoftwareSourceCode', () => {
    const project = projectSchema({
      path: '/en/projects/x',
      name: 'X',
      locale: 'en',
      repoUrl: 'https://github.com/a/x',
      technologies: ['Next.js', 'TypeScript', 'NestJS', 'TypeScript', 'Docker'],
    })
    expect(project['@type']).toBe('SoftwareSourceCode')
    // Only actual languages; frameworks/tools stay in `keywords`.
    expect(project.programmingLanguage).toEqual(['TypeScript'])
    expect(project.keywords).toBe('Next.js, TypeScript, NestJS, Docker')
    expect(projectSchema({ path: '/en/projects/y', name: 'Y', locale: 'en' })['@type']).toBe('CreativeWork')
  })
})

describe('offerCatalogSchema', () => {
  it('lists packages as offers of the organization, with starting prices as minPrice', () => {
    const catalog = offerCatalogSchema(
      '/en/freelance',
      'Packages',
      [
        { title: 'Website', description: 'A fast, responsive site.', priceFrom: 1500 },
        { title: 'Consulting', description: '', priceFrom: null },
      ],
      'EUR',
    )

    expect(catalog['@type']).toBe('OfferCatalog')
    expect(catalog.itemListElement).toEqual([
      {
        '@type': 'Offer',
        offeredBy: { '@id': SCHEMA_IDS.organization },
        itemOffered: { '@type': 'Service', name: 'Website', description: 'A fast, responsive site.' },
        priceSpecification: { '@type': 'PriceSpecification', minPrice: 1500, priceCurrency: 'EUR' },
      },
      // No price and no description: both are left out rather than emptied.
      {
        '@type': 'Offer',
        offeredBy: { '@id': SCHEMA_IDS.organization },
        itemOffered: { '@type': 'Service', name: 'Consulting' },
      },
    ])
  })
})
