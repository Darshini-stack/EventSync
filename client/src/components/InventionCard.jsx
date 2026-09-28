import React from 'react';
import { Sparkles, Calendar, Lightbulb, GraduationCap, Building, Code2, Award, HeartHandshake } from 'lucide-react';
import { Badge } from './common/Badge';
import creatorPhoto from '../assets/creator.jpg';
import { CREATOR_DATA } from '../data/creatorConfig';

export const InventionCard = ({ card }) => {
  if (!card) return null;

  const name = card.person || CREATOR_DATA.name;
  const role = card.role || CREATOR_DATA.role;
  const project = card.subject || CREATOR_DATA.project;
  const education = card.education || CREATOR_DATA.education;
  const college = card.college || CREATOR_DATA.college;
  const interests = card.interests || CREATOR_DATA.interests;
  const knownFor = card.known_for || CREATOR_DATA.known_for;
  const year = card.year || CREATOR_DATA.year;
  const summary = card.summary || CREATOR_DATA.summary;
  const funFact = card.fun_fact || CREATOR_DATA.fun_fact;

  return (
    <div
      className="invention-card creator-card"
      style={{
        marginTop: '0.75rem',
        borderRadius: '1.25rem',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.98) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4), 0 0 24px rgba(99, 102, 241, 0.2)',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.18) 0%, rgba(236, 72, 153, 0.12) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Creator Portrait from local asset */}
        <div
          style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            padding: '3px',
            background: 'linear-gradient(135deg, #6366F1, #EC4899, #F59E0B)',
            flexShrink: 0,
            boxShadow: '0 4px 18px rgba(99, 102, 241, 0.5)',
          }}
        >
          <img
            src={creatorPhoto}
            alt={name}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              objectPosition: 'top',
              background: '#1E293B',
            }}
          />
        </div>

        {/* Title & Badges */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <Badge variant="primary" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={11} style={{ marginRight: '0.25rem' }} />
              Creator & Developer
            </Badge>
            <Badge variant="info" style={{ fontSize: '0.72rem' }}>
              <Code2 size={11} style={{ marginRight: '0.25rem' }} />
              {project}
            </Badge>
            {year && (
              <Badge variant="warning" style={{ fontSize: '0.72rem' }}>
                <Calendar size={11} style={{ marginRight: '0.25rem' }} />
                {year}
              </Badge>
            )}
          </div>

          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#FFFFFF', lineHeight: 1.2 }}>
            {name}
          </h3>

          <div style={{ fontSize: '0.85rem', color: '#A5B4FC', fontWeight: '600', marginTop: '0.2rem' }}>
            {role}
          </div>
        </div>
      </div>

      {/* Verified Attributes Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          padding: '1rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.5)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.82rem',
        }}
      >
        {education && (
          <div>
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <GraduationCap size={13} color="#818CF8" /> Education
            </span>
            <strong style={{ color: '#F1F5F9', marginTop: '0.15rem', display: 'block', fontWeight: '600' }}>
              {education}
            </strong>
          </div>
        )}

        {college && (
          <div>
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Building size={13} color="#818CF8" /> College
            </span>
            <strong style={{ color: '#F1F5F9', marginTop: '0.15rem', display: 'block', fontWeight: '600' }}>
              {college}
            </strong>
          </div>
        )}

        {interests && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <HeartHandshake size={13} color="#EC4899" /> Technical Focus & Interests
            </span>
            <span style={{ color: '#E2E8F0', marginTop: '0.15rem', display: 'block' }}>
              {interests}
            </span>
          </div>
        )}

        {knownFor && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Award size={13} color="#F59E0B" /> Known For
            </span>
            <span style={{ color: '#E2E8F0', marginTop: '0.15rem', display: 'block', lineHeight: 1.4 }}>
              {knownFor}
            </span>
          </div>
        )}
      </div>

      {/* Body: Summary & Fun Fact */}
      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {summary && (
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.55', color: '#CBD5E1' }}>
            {summary}
          </p>
        )}

        {funFact && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.65rem',
              background: 'rgba(245, 158, 11, 0.12)',
              borderLeft: '4px solid #F59E0B',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              fontSize: '0.83rem',
              color: '#FDE68A',
            }}
          >
            <Lightbulb size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#FBBF24', marginRight: '0.4rem' }}>Innovation Highlight:</strong>
              <span>{funFact}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
