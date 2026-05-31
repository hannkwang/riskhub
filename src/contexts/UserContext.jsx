import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const UserContext = createContext(null);

const ROLE_LABELS = {
  engineer:       'Engineer',
  biz_owner:      'System Owner',
  security:       'Cyber Security',
  tech_governance:'Tech Governance Assurance',
  grc_chair:      'GRC Co-Chair',
};

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => {
    const stored = localStorage.getItem('riskhub_user') || 'mira';
    localStorage.setItem('riskhub_user', stored);
    return stored;
  });

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(() => {
        // Fallback if server not running
        setUsers([
          { id: 'mira',    name: 'Mira Tanaka',  role: 'engineer',   team: 'App / Payments' },
          { id: 'jordan',  name: 'Jordan Walsh',  role: 'biz_owner',  team: 'Payments BU' },
          { id: 'hana',    name: 'Hana Brooks',   role: 'security',   team: 'AppSec' },
          { id: 'eleanor', name: 'Eleanor Voss',  role: 'grc_chair',  team: 'GRC Council' },
        ]);
      });
  }, []);

  const currentUser = users.find(u => u.id === currentUserId) || null;

  function switchUser(id) {
    setCurrentUserId(id);
    localStorage.setItem('riskhub_user', id);
  }

  return (
    <UserContext.Provider value={{ currentUser, users, switchUser, ROLE_LABELS }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}

export { ROLE_LABELS };
