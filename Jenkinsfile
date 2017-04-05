pipeline {
  agent {
    dockerfile {
      filename 'jenkins/node610.dockerfile'
    }
    
  }
  stages {
    stage('Install') {
      steps {
        sh 'npm install'
      }
    }
    stage('Test') {
      steps {
        sh 'npm test'
      }
    }
  }
}