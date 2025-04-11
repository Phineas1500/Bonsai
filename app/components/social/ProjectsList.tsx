import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ProjectData, ProjectMember } from '../utils/projectChatManagement';


interface ProjectsListProps {
  refreshTrigger?: boolean; // Can be used to trigger a refresh from parent
}

const ProjectsList = ({ refreshTrigger }: ProjectsListProps) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  // Fetch projects where the current user is a member
  const fetchProjects = async () => {
    if (!currentUser?.email) return;

    setLoading(true);
    try {
      // Query for projects where the user is a member
      const projectsRef = collection(db, 'projects');
      const q = query(projectsRef, where('members', 'array-contains',
        {email: currentUser.email, username: currentUser.displayName}
      ));
      const querySnapshot = await getDocs(q);

      const projectList: ProjectData[] = [];
      querySnapshot.forEach((doc) => {
        projectList.push({
          id: doc.id,
          ...doc.data() as Omit<ProjectData, 'id'>
        });
      });

      // Sort projects by name
      projectList.sort((a, b) => a.name.localeCompare(b.name));
      setProjects(projectList);
    } catch (error) {
      console.error('Error fetching projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and refresh when trigger changes
  useEffect(() => {
    fetchProjects();
  }, [currentUser, refreshTrigger]);

  // Navigate to project details screen
  const handleProjectPress = (projectId: string) => {
    router.push({
      pathname: '/screens/project',
      params: { projectId }
    });
  };

  // PLACEHOLDER @CALEB
  const handleCreateProject = () => {
    Alert.alert('PLACEHOLDER', 'AAAAA');
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-8">
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View>
      {/* Create Project Button */}
      <TouchableOpacity
        className="flex-row items-center self-end bg-teal-700 px-3 py-1.5 rounded-lg mb-3"
        onPress={handleCreateProject}
      >
        <Feather name="plus-circle" size={16} color="white" />
        <Text className="text-white ml-1.5 text-sm font-medium">New Project</Text>
      </TouchableOpacity>

      {/* Project List */}
      {projects.length > 0 ? (
        <View>
          {projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              className="flex-row items-center bg-neutral-900 p-3 rounded-lg mb-2"
              onPress={() => handleProjectPress(project.id)}
            >
              <View className="bg-teal-900 h-10 w-10 rounded-full items-center justify-center mr-3">
                <Feather name="folder" size={18} color="#14b8a6" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">{project.name}</Text>
                <Text className="text-gray-400 text-xs">
                  {project.members.length} {project.members.length === 1 ? 'member' : 'members'}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#14b8a6" />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View className="py-8 items-center">
          <Feather name="folder" size={40} color="#555" />
          <Text className="text-white text-center mt-4">You don't have any projects yet</Text>
          <Text className="text-gray-400 text-center mt-2">Create a new project to get started</Text>
        </View>
      )}
    </View>
  );
};

export default ProjectsList;
