/**
 * @file Tests the demo's guard, environment and printed text.
 * @requirement NFR-05
 */

import { describe, expect, it } from 'vitest';

import { buildDemoSeedPlan, DEV_SEED_ISSUER } from '@caa/db/testing';

import {
  assertDemoAllowed,
  buildDemoEnv,
  DEMO_PERSONAS,
  DemoRefusedError,
  describeDatabaseDown,
  describeReady,
} from './demo.mjs';

describe('assertDemoAllowed', () => {
  it('accepts the default local database', () => {
    expect(assertDemoAllowed({})).toEqual({
      databaseUrl: 'postgres://caa:caa@localhost:5432/caa',
      host: 'localhost',
      port: 5432,
    });
  });

  it('accepts 127.0.0.1 with another port', () => {
    const target = assertDemoAllowed({ DATABASE_URL: 'postgres://u:p@127.0.0.1:6543/x' });
    expect(target).toMatchObject({ host: '127.0.0.1', port: 6543 });
  });

  it('refuses production before anything else', () => {
    expect(() => assertDemoAllowed({ NODE_ENV: 'production' })).toThrow(DemoRefusedError);
  });

  it.each([
    ['a remote host', 'postgres://u:p@db.example.com:5432/caa'],
    ['a look-alike host', 'postgres://u:p@localhost.example.com/caa'],
    ['a host query parameter', 'postgres://u:p@localhost/caa?host=db.example.com'],
    ['a port query parameter', 'postgres://u:p@localhost/caa?port=1'],
    ['no host', 'postgres:///caa'],
    ['a non-postgres URL', 'http://localhost/caa'],
    ['text that is not a URL', 'not a url'],
  ])('refuses %s without echoing the URL', (_name, databaseUrl) => {
    let message = '';
    try {
      assertDemoAllowed({ DATABASE_URL: databaseUrl });
    } catch (error) {
      expect(error).toBeInstanceOf(DemoRefusedError);
      message = error.message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain('example.com');
    expect(message).not.toContain('u:p');
  });
});

describe('buildDemoEnv', () => {
  const env = buildDemoEnv(
    {
      PATH: '/bin',
      AUTH_MODE: 'none',
      CONVERSATION_MODEL: 'claude',
      ANTHROPIC_API_KEY: 'sk-secret',
    },
    'postgres://caa:caa@localhost:5432/caa',
  );

  it('forces the demo model, dev sign-in and the seeded ruleset over the shell', () => {
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      AUTH_MODE: 'dev',
      CONVERSATION_MODEL: 'demo',
      ACTIVE_RULESET_VERSION: 'demo-2026.1',
      PATH: '/bin',
    });
  });

  it('never passes an API key to the stack', () => {
    expect(env).not.toHaveProperty('ANTHROPIC_API_KEY');
  });

  it('signs every persona in as its synthetic identity', () => {
    const tokens = JSON.parse(env.DEV_AUTH_TOKENS);
    expect(Object.keys(tokens).sort()).toEqual(DEMO_PERSONAS.map((p) => p.token).sort());
    expect(tokens['dev-token-student-stale'].subject).toBe('synthetic-student-006');
  });
});

describe('messages', () => {
  it('says how to start Postgres', () => {
    expect(describeDatabaseDown({ host: 'localhost', port: 5432 })).toContain(
      'docker compose -f infra/docker-compose.yml up -d',
    );
  });

  it('prints the sign-in URL, every token and the case count', () => {
    const text = describeReady({ cases: 2 });
    expect(text).toContain('http://localhost:3000/dev/sign-in');
    for (const persona of DEMO_PERSONAS) {
      expect(text).toContain(persona.token);
    }
    expect(text).toContain('2 open cases');
  });
});

describe('DEMO_PERSONAS', () => {
  const plan = buildDemoSeedPlan(new Date('2026-10-01T12:00:00.000Z'));

  it('names the seeded identities, students and issuer', () => {
    for (const persona of DEMO_PERSONAS) {
      const identity = plan.identities.find((candidate) => candidate.subject === persona.subject);
      expect(identity, persona.subject).toBeDefined();
      expect(identity.issuer).toBe(DEV_SEED_ISSUER);
      if (persona.studentId !== null) {
        const student = plan.students.find(
          (candidate) => candidate.userSubject === persona.subject,
        );
        expect(student.id).toBe(persona.studentId);
        if (persona.sourceStudentId !== undefined) {
          expect(student.sourceStudentId).toBe(persona.sourceStudentId);
        }
      }
    }
  });

  it('assigns the demo students to the demo advisor', () => {
    for (const persona of DEMO_PERSONAS.filter((candidate) => candidate.sourceStudentId)) {
      const assignment = plan.assignments.find(
        (candidate) => candidate.sourceStudentId === persona.sourceStudentId,
      );
      expect(assignment.advisorSubject).toBe('synthetic-advisor-001');
    }
  });
});
